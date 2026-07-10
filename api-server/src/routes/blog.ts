import { Router } from "express";
import { db, blogPosts, placePhotos, travelBlogSettings, userSubscriptions } from "@workspace/db";
import { and, eq, notInArray, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { isR2Configured, loadObject, saveObject } from "../utils/storage";

const router = Router();
const MAX_PUBLIC_SYNC_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_INLINE_PUBLIC_IMAGE_BYTES = 1.25 * 1024 * 1024;
const ACCOUNT_STORAGE_LIMIT_BYTES = 5 * 1024 * 1024 * 1024;
const ALLOWED_PUBLIC_SYNC_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

class PublicSyncUploadError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function uid() {
  return Date.now().toString() + Math.random().toString(36).slice(2, 11);
}

function sanitizeUsername(value: string) {
  return value
    .trim()
    .replace(/^@+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 24);
}

function allowedLocalPublishUsernames() {
  return (process.env.PUBLIC_LOCAL_BLOG_USERNAMES ?? "josh")
    .split(",")
    .map(item => item.trim() === "*" ? "*" : sanitizeUsername(item))
    .filter(Boolean);
}

function canPublishLocalUsername(username: string) {
  const allowed = allowedLocalPublishUsernames();
  return allowed.includes("*") || allowed.includes(username);
}

function isProActive(sub: { isPro: boolean; proUntil: Date | null } | undefined) {
  if (!sub?.isPro) return false;
  if (!sub.proUntil) return true;
  return sub.proUntil > new Date();
}

async function requirePremiumPublishing(userId: string, res: any) {
  const [sub] = await db.select().from(userSubscriptions).where(eq(userSubscriptions.userId, userId));
  if (isProActive(sub)) return true;
  res.status(402).json({ error: "Premium is required to publish public blog posts" });
  return false;
}

function localPublishUserId(username: string) {
  return `local-blog:${username}`;
}

function settingsPayload(row: typeof travelBlogSettings.$inferSelect | undefined) {
  if (!row) return null;
  return {
    id: row.userId,
    username: row.username,
    title: row.title,
    intro: row.intro,
    privacy: row.privacy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function postPayload(row: typeof blogPosts.$inferSelect, includePassword = false) {
  return {
    id: row.id,
    sourcePlaceId: row.sourcePlaceId,
    status: row.status,
    privacy: row.privacy,
    ...(includePassword ? { password: row.password ?? undefined } : {}),
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle,
    opening: row.opening,
    body: row.body,
    coverPhotoId: row.coverPhotoId ?? undefined,
    coverImageUrl: row.coverImageUrl ?? undefined,
    photos: Array.isArray(row.photos) ? row.photos : [],
    place: row.place,
    country: row.country,
    city: row.city ?? undefined,
    dateVisited: row.dateVisited,
    category: row.category,
    tags: Array.isArray(row.tags) ? row.tags : [],
    hideExactLocation: row.hideExactLocation,
    hideDate: row.hideDate,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    publishedAt: row.publishedAt?.toISOString() ?? null,
  };
}

function passwordValue(body: any, existing?: typeof blogPosts.$inferSelect) {
  if (body.privacy && body.privacy !== "password") return null;
  if (typeof body.password === "string") return body.password.trim() || null;
  return existing?.password ?? null;
}

function postValues(userId: string, body: any, existing?: typeof blogPosts.$inferSelect) {
  const now = new Date();
  const nextPrivacy = body.privacy ?? existing?.privacy ?? "private";
  const nextStatus = nextPrivacy === "private" ? "draft" : body.status ?? existing?.status ?? "draft";
  return {
    userId,
    sourcePlaceId: body.sourcePlaceId ?? existing?.sourcePlaceId ?? "",
    status: nextStatus,
    privacy: nextPrivacy,
    password: passwordValue(body, existing),
    slug: body.slug ?? existing?.slug ?? "travel-memory",
    title: body.title ?? existing?.title ?? "Travel memory",
    subtitle: body.subtitle ?? existing?.subtitle ?? "",
    opening: body.opening ?? existing?.opening ?? "",
    body: body.body ?? existing?.body ?? "",
    coverPhotoId: body.coverPhotoId ?? existing?.coverPhotoId ?? null,
    coverImageUrl: body.coverImageUrl ?? existing?.coverImageUrl ?? null,
    photos: body.photos ?? existing?.photos ?? [],
    place: body.place ?? existing?.place ?? "",
    country: body.country ?? existing?.country ?? "",
    city: body.city ?? existing?.city ?? null,
    dateVisited: body.dateVisited ?? existing?.dateVisited ?? "",
    category: body.category ?? existing?.category ?? "Travel",
    tags: body.tags ?? existing?.tags ?? [],
    hideExactLocation: Boolean(body.hideExactLocation ?? existing?.hideExactLocation ?? false),
    hideDate: Boolean(body.hideDate ?? existing?.hideDate ?? false),
    updatedAt: now,
    publishedAt: nextStatus === "published" ? (body.publishedAt ? new Date(body.publishedAt) : existing?.publishedAt ?? null) : null,
  };
}

function publicImagePath(photoId: string, password?: string) {
  const query = password ? `?password=${encodeURIComponent(password)}` : "";
  return `/api/blog/public/images/${encodeURIComponent(photoId)}${query}`;
}

function requestPhotoId(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function safeObjectSegment(value: string) {
  return value
    .replace(/[^a-z0-9_-]/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "item";
}

function extForContentType(contentType: string) {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  return "jpg";
}

function isPublicPhotoStorageConfigured() {
  return Boolean(process.env.PRIVATE_OBJECT_DIR || isR2Configured());
}

function ensurePublicPhotoStorageConfigured() {
  if (isPublicPhotoStorageConfigured()) return;
  throw new PublicSyncUploadError(
    503,
    "Object storage is not configured. Set R2_BUCKET_NAME, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_ACCOUNT_ID or R2_ENDPOINT in Railway before publishing blog photos.",
  );
}

function inlinePublicImageUrl(upload: { buffer: Buffer; contentType: string }) {
  if (upload.buffer.length > MAX_INLINE_PUBLIC_IMAGE_BYTES) {
    throw new PublicSyncUploadError(
      503,
      "Object storage is not configured and this photo is too large for the temporary inline publish path. Please set the R2_* variables in Railway.",
    );
  }
  return `data:${upload.contentType};base64,${upload.buffer.toString("base64")}`;
}

async function readRawImageBody(req: any) {
  const contentType = String(req.headers["content-type"] ?? "image/jpeg").split(";")[0].trim().toLowerCase();
  if (!ALLOWED_PUBLIC_SYNC_IMAGE_TYPES.has(contentType)) {
    throw new PublicSyncUploadError(415, "Unsupported image type. Please choose a JPG, PNG, or WebP photo.");
  }

  const chunks: Buffer[] = [];
  let size = 0;
  let tooLarge = false;
  await new Promise<void>((resolve, reject) => {
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_PUBLIC_SYNC_IMAGE_BYTES) {
        tooLarge = true;
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", resolve);
    req.on("error", reject);
  });

  if (tooLarge) {
    throw new PublicSyncUploadError(413, "One of the blog photos is too large. Please choose a smaller image and publish again.");
  }
  const buffer = Buffer.concat(chunks);
  if (!buffer.length) {
    throw new PublicSyncUploadError(400, "Empty image upload. Please re-add the photo and try again.");
  }
  return { buffer, contentType };
}

function decodeDataImage(value: unknown) {
  if (typeof value !== "string") return null;
  const match = value.match(/^data:(image\/(?:jpe?g|png|webp));base64,([a-z0-9+/=\s]+)$/i);
  if (!match) return null;
  const contentType = match[1].toLowerCase() === "image/jpg" ? "image/jpeg" : match[1].toLowerCase();
  const buffer = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (!buffer.length) return null;
  return { buffer, contentType };
}

function stripPhotoUploadData(photo: any) {
  const { imageData, uploadData, localImageData, ...clean } = photo ?? {};
  return clean;
}

function urlPath(value: unknown) {
  if (typeof value !== "string") return "";
  try {
    return new URL(value, "https://travelbean.local").pathname;
  } catch {
    return value.split("?")[0];
  }
}

function isPrivateBeanPhotoUrl(value: unknown) {
  return /^\/api\/bean\/photos\/img\//i.test(urlPath(value));
}

function isPublicBlogImageUrl(value: unknown) {
  return /^\/api\/blog\/public\/images\//i.test(urlPath(value));
}

function isReusablePublicImageUrl(value: unknown) {
  if (typeof value !== "string") return false;
  if (/^data:image\//i.test(value)) return true;
  if (!/^https?:\/\//i.test(value)) return false;
  return !isPrivateBeanPhotoUrl(value) && !isPublicBlogImageUrl(value);
}

async function storedPhotoBytesForUser(userId: string) {
  const [usage] = await db
    .select({ bytes: sql<number>`coalesce(sum(${placePhotos.byteSize}), 0)` })
    .from(placePhotos)
    .where(eq(placePhotos.userId, userId));
  return Number(usage?.bytes ?? 0);
}

async function savePublicSyncPhoto(userId: string, sourcePlaceId: string, photo: any) {
  const upload = decodeDataImage(photo?.imageData ?? photo?.uploadData ?? photo?.localImageData ?? photo?.imageUrl);
  const cleanPhoto = stripPhotoUploadData(photo);
  if (!photo?.id) return cleanPhoto;

  const photoId = String(photo.id);
  const [existing] = await db.select().from(placePhotos).where(and(
    eq(placePhotos.id, photoId),
    eq(placePhotos.userId, userId),
  ));
  if (!upload) {
    if (existing) return { ...cleanPhoto, imageUrl: publicImagePath(photoId) };
    if (isReusablePublicImageUrl(cleanPhoto.imageUrl)) return cleanPhoto;
    throw new PublicSyncUploadError(400, "Could not publish one of the blog photos. Please re-add the photo and publish again.");
  }

  if (upload.buffer.length > MAX_PUBLIC_SYNC_IMAGE_BYTES) {
    throw new PublicSyncUploadError(413, "One of the blog photos is too large. Please choose a smaller image and publish again.");
  }

  const currentStorageBytes = await storedPhotoBytesForUser(userId);
  const replacingBytes = Number(existing?.byteSize ?? 0);
  if (currentStorageBytes - replacingBytes + upload.buffer.length > ACCOUNT_STORAGE_LIMIT_BYTES) {
    throw new PublicSyncUploadError(413, "Photo storage limit reached. You have used your 5GB optimized photo storage.");
  }

  if (!isPublicPhotoStorageConfigured()) {
    return {
      ...cleanPhoto,
      imageUrl: inlinePublicImageUrl(upload),
    };
  }

  const objectPath = `/objects/blog/${safeObjectSegment(userId)}/${safeObjectSegment(sourcePlaceId || "post")}/${safeObjectSegment(photoId)}.${extForContentType(upload.contentType)}`;
  ensurePublicPhotoStorageConfigured();
  await saveObject(objectPath, upload.buffer, upload.contentType);

  const values = {
    id: photoId,
    userId,
    placeId: sourcePlaceId || "blog-post",
    objectPath,
    byteSize: upload.buffer.length,
    caption: typeof photo.caption === "string" ? photo.caption : "",
  };
  if (existing) {
    await db.update(placePhotos)
      .set({
        userId,
        placeId: values.placeId,
        objectPath,
        byteSize: values.byteSize,
        caption: values.caption,
      })
      .where(eq(placePhotos.id, photoId));
  } else {
    await db.insert(placePhotos).values(values);
  }

  return {
    ...cleanPhoto,
    imageUrl: publicImagePath(photoId),
  };
}

async function savePublicSyncRawPhoto(
  userId: string,
  sourcePlaceId: string,
  photoId: string,
  caption: string,
  upload: { buffer: Buffer; contentType: string },
) {
  if (upload.buffer.length > MAX_PUBLIC_SYNC_IMAGE_BYTES) {
    throw new PublicSyncUploadError(413, "One of the blog photos is too large. Please choose a smaller image and publish again.");
  }

  const [existing] = await db.select().from(placePhotos).where(and(
    eq(placePhotos.id, photoId),
    eq(placePhotos.userId, userId),
  ));

  const currentStorageBytes = await storedPhotoBytesForUser(userId);
  const replacingBytes = Number(existing?.byteSize ?? 0);
  if (currentStorageBytes - replacingBytes + upload.buffer.length > ACCOUNT_STORAGE_LIMIT_BYTES) {
    throw new PublicSyncUploadError(413, "Photo storage limit reached. You have used your 5GB optimized photo storage.");
  }

  if (!isPublicPhotoStorageConfigured()) {
    return {
      id: photoId,
      imageUrl: inlinePublicImageUrl(upload),
      caption,
    };
  }

  const objectPath = `/objects/blog/${safeObjectSegment(userId)}/${safeObjectSegment(sourcePlaceId || "post")}/${safeObjectSegment(photoId)}.${extForContentType(upload.contentType)}`;
  ensurePublicPhotoStorageConfigured();
  await saveObject(objectPath, upload.buffer, upload.contentType);

  const values = {
    userId,
    placeId: sourcePlaceId || "blog-post",
    objectPath,
    byteSize: upload.buffer.length,
    caption,
  };

  if (existing) {
    await db.update(placePhotos)
      .set(values)
      .where(and(eq(placePhotos.id, photoId), eq(placePhotos.userId, userId)));
  } else {
    await db.insert(placePhotos).values({
      id: photoId,
      ...values,
    });
  }

  return {
    id: photoId,
    imageUrl: publicImagePath(photoId),
    caption,
  };
}

async function normalizePublicSyncPostPhotos(userId: string, post: any) {
  const sourcePlaceId = String(post.sourcePlaceId ?? post.source_place_id ?? post.id ?? "");
  const rawPhotos = Array.isArray(post.photos) ? post.photos.slice(0, 8) : [];
  const photos = [];
  for (const photo of rawPhotos) {
    photos.push(await savePublicSyncPhoto(userId, sourcePlaceId, photo));
  }
  const coverPhotoId = post.coverPhotoId ?? post.cover_photo_id ?? photos[0]?.id;
  const coverPhoto = photos.find((photo: any) => photo?.id === coverPhotoId);
  return {
    ...post,
    coverPhotoId,
    coverImageUrl: coverPhoto?.imageUrl ?? post.coverImageUrl ?? post.cover_image_url,
    photos,
  };
}

function canUseStoredImageUrl(value: unknown) {
  return isReusablePublicImageUrl(value);
}

function publicBlogPhotos(post: typeof blogPosts.$inferSelect, options: { redacted?: boolean; password?: string } = {}) {
  const imagePassword = post.privacy === "password" ? options.password : undefined;
  if (options.redacted || (post.privacy === "password" && !imagePassword)) {
    return {
      coverImageUrl: undefined,
      photos: [],
    };
  }
  const photos = (Array.isArray(post.photos) ? post.photos : []).map((photo: any) => ({
    ...photo,
    imageUrl: canUseStoredImageUrl(photo?.imageUrl) ? photo.imageUrl : (photo?.id ? publicImagePath(photo.id, imagePassword) : photo?.imageUrl),
  }));
  return {
    coverImageUrl: canUseStoredImageUrl(post.coverImageUrl) ? post.coverImageUrl : (post.coverPhotoId ? publicImagePath(post.coverPhotoId, imagePassword) : post.coverImageUrl),
    photos,
  };
}

function publicListPostPayload(post: typeof blogPosts.$inferSelect) {
  const isPasswordProtected = post.privacy === "password";
  return {
    ...postPayload(post, false),
    body: isPasswordProtected ? "" : post.body,
    opening: isPasswordProtected ? "" : post.opening,
    ...(isPasswordProtected ? { passwordRequired: true } : {}),
    ...publicBlogPhotos(post, { redacted: isPasswordProtected }),
  };
}

function isEmail(value: unknown): value is string {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

async function accountEmailForUser(userId: string, fallbackEmail?: string) {
  const clerkSecret = process.env.CLERK_SECRET_KEY;
  if (!clerkSecret) return fallbackEmail;
  try {
    const response = await fetch(`https://api.clerk.com/v1/users/${encodeURIComponent(userId)}`, {
      headers: {
        Authorization: `Bearer ${clerkSecret}`,
        "Content-Type": "application/json",
      },
    });
    if (!response.ok) return fallbackEmail;
    const user = await response.json() as any;
    const addresses = Array.isArray(user.email_addresses) ? user.email_addresses : [];
    const primary = addresses.find((address: any) => address.id === user.primary_email_address_id) ?? addresses[0];
    return primary?.email_address ?? fallbackEmail;
  } catch {
    return fallbackEmail;
  }
}

function dashboardUrl() {
  const configured =
    process.env.DASHBOARD_URL ??
    (process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN.replace(/^https?:\/\//, "")}/dashboard` : undefined);
  return configured ?? "https://travel-bean-production.up.railway.app/dashboard";
}

function dashboardEmailBody() {
  const url = dashboardUrl();
  return [
    "Open your Travel Bean dashboard from your laptop:",
    "",
    url,
    "",
    "Log in on web to edit blog posts, organise drafts, and publish your travel stories.",
  ].join("\n");
}

async function canServePublicPhoto(photoId: string, password?: string) {
  const posts = await db.select().from(blogPosts).where(eq(blogPosts.status, "published"));
  for (const post of posts) {
    const isAllowed = post.privacy === "public" || (post.privacy === "password" && password && post.password === password);
    if (!isAllowed) continue;
    if (post.coverPhotoId === photoId) return post.userId;
    const photos = Array.isArray(post.photos) ? post.photos : [];
    if (photos.some((photo: any) => photo?.id === photoId && photo?.included !== false)) {
      return post.userId;
    }
  }
  return null;
}

router.get("/public/images/:photoId", async (req, res) => {
  const password = typeof req.query.password === "string" ? req.query.password : undefined;
  const photoId = requestPhotoId(req.params.photoId);
  const userId = await canServePublicPhoto(photoId, password);
  if (!userId) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [row] = await db.select().from(placePhotos).where(and(
    eq(placePhotos.id, photoId),
    eq(placePhotos.userId, userId),
  ));
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  try {
    const { contentType, stream } = await loadObject(row.objectPath);
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    stream.pipe(res);
  } catch (err: any) {
    req.log.error({ err }, "public blog photo serve error");
    res.status(500).json({ error: "Could not load photo" });
  }
});

router.get("/public/:username", async (req, res) => {
  const username = sanitizeUsername(req.params.username);
  const [settings] = await db.select().from(travelBlogSettings).where(eq(travelBlogSettings.username, username));
  if (!settings || settings.privacy === "private") {
    res.status(404).json({ error: "Blog not found" });
    return;
  }
  const posts = await db.select().from(blogPosts).where(and(
    eq(blogPosts.userId, settings.userId),
    eq(blogPosts.status, "published"),
  ));
  res.json({
    settings: settingsPayload(settings),
    posts: posts
      .filter(post => post.privacy !== "private")
      .map(publicListPostPayload),
  });
});

router.get("/public/:username/:slug", async (req, res) => {
  const username = sanitizeUsername(req.params.username);
  const [settings] = await db.select().from(travelBlogSettings).where(eq(travelBlogSettings.username, username));
  if (!settings || settings.privacy === "private") {
    res.status(404).json({ error: "Post not found" });
    return;
  }
  const [post] = await db.select().from(blogPosts).where(and(
    eq(blogPosts.userId, settings.userId),
    eq(blogPosts.slug, req.params.slug),
    eq(blogPosts.status, "published"),
  ));
  if (!post || post.privacy === "private") {
    res.status(404).json({ error: "Post not found" });
    return;
  }
  const suppliedPassword = typeof req.query.password === "string" ? req.query.password : undefined;
  if (post.privacy === "password" && (!post.password || suppliedPassword !== post.password)) {
    res.json({
      settings: settingsPayload(settings),
      post: {
        ...postPayload(post, false),
        body: "",
        opening: "",
        coverImageUrl: undefined,
        photos: [],
        passwordRequired: true,
      },
    });
    return;
  }
  res.json({
    settings: settingsPayload(settings),
    post: {
      ...postPayload(post, false),
      ...publicBlogPhotos(post, { password: suppliedPassword }),
    },
  });
});

router.post("/public-sync/photo", async (req, res) => {
  const username = sanitizeUsername(String(req.query.username ?? ""));
  const sourcePlaceId = String(req.query.sourcePlaceId ?? "blog-post").slice(0, 120);
  const photoId = String(req.query.photoId ?? "").slice(0, 160);
  const caption = String(req.query.caption ?? "").slice(0, 500);

  if (!username) {
    res.status(400).json({ success: false, error: "Username is required" });
    return;
  }
  if (!photoId) {
    res.status(400).json({ success: false, error: "Photo id is required" });
    return;
  }
  if (!canPublishLocalUsername(username)) {
    res.status(403).json({ success: false, error: "This trial publish route is not enabled for that username" });
    return;
  }

  const [taken] = await db.select().from(travelBlogSettings).where(eq(travelBlogSettings.username, username));
  const userId = taken?.userId ?? localPublishUserId(username);

  try {
    const upload = await readRawImageBody(req);
    req.log.info({ username, photoId, sourcePlaceId, bytes: upload.buffer.length, contentType: upload.contentType }, "[PHOTO_UPLOAD] public blog photo upload started");
    const photo = await savePublicSyncRawPhoto(userId, sourcePlaceId, photoId, caption, upload);
    req.log.info({ username, photoId, imageUrl: photo.imageUrl }, "[PHOTO_UPLOAD] public blog photo upload complete");
    res.json({ success: true, photo });
  } catch (err: any) {
    req.log.error({ err, username, photoId, sourcePlaceId }, "[PHOTO_UPLOAD_ERROR] public blog photo upload failed");
    const status = err instanceof PublicSyncUploadError ? err.status : 500;
    res.status(status).json({ success: false, error: err?.message ?? "Could not upload blog photo" });
  }
});

router.post("/public-sync", async (req, res) => {
  const body = req.body ?? {};
  const incomingSettings = body.settings ?? {};
  const username = sanitizeUsername(incomingSettings.username ?? "");
  if (!username) {
    res.status(400).json({ error: "Username is required" });
    return;
  }
  if (!canPublishLocalUsername(username)) {
    res.status(403).json({ error: "This trial publish route is not enabled for that username" });
    return;
  }

  const now = new Date();
  const [taken] = await db.select().from(travelBlogSettings).where(eq(travelBlogSettings.username, username));
  const userId = taken?.userId ?? localPublishUserId(username);

  let settings = taken;
  const settingsValues = {
    username,
    title: incomingSettings.title ?? taken?.title ?? "My Travel Bean Blog",
    intro: incomingSettings.intro ?? taken?.intro ?? "",
    privacy: "public",
    updatedAt: now,
  };
  if (settings) {
    const [row] = await db.update(travelBlogSettings)
      .set(settingsValues)
      .where(eq(travelBlogSettings.username, username))
      .returning();
    settings = row;
  } else {
    const [row] = await db.insert(travelBlogSettings).values({
      userId,
      ...settingsValues,
    }).returning();
    settings = row;
  }

  const incomingPosts = (Array.isArray(body.posts) ? body.posts : [])
    .filter((post: any) => post?.id && post?.slug && post?.title)
    .slice(0, 100);
  const replaceAllPosts = body.replaceAll !== false;
  if (replaceAllPosts) {
    const incomingIds = incomingPosts.map((post: any) => String(post.id));
    if (incomingIds.length) {
      await db.delete(blogPosts).where(and(
        eq(blogPosts.userId, userId),
        notInArray(blogPosts.id, incomingIds),
      ));
    } else {
      await db.delete(blogPosts).where(eq(blogPosts.userId, userId));
    }
  }

  const savedPosts: Array<typeof blogPosts.$inferSelect> = [];
  try {
    for (const incomingPost of incomingPosts) {
      const post = await normalizePublicSyncPostPhotos(userId, incomingPost);
      const [existing] = await db.select().from(blogPosts).where(and(
        eq(blogPosts.id, String(post.id)),
        eq(blogPosts.userId, userId),
      ));
      const isPublished = post.status === "published" && (post.privacy !== "password" || Boolean(String(post.password ?? "").trim()));
      const values = {
        ...postValues(userId, {
          ...post,
          status: isPublished ? "published" : "draft",
          privacy: isPublished ? (post.privacy === "password" ? "password" : "public") : "private",
          publishedAt: isPublished ? post.publishedAt ?? now.toISOString() : null,
        }, existing),
        publishedAt: isPublished ? (post.publishedAt ? new Date(post.publishedAt) : existing?.publishedAt ?? now) : null,
      };
      if (existing) {
        const [row] = await db.update(blogPosts)
          .set(values)
          .where(and(eq(blogPosts.id, String(post.id)), eq(blogPosts.userId, userId)))
          .returning();
        if (row) savedPosts.push(row);
      } else {
        const [row] = await db.insert(blogPosts).values({
          id: String(post.id),
          ...values,
        }).returning();
        if (row) savedPosts.push(row);
      }
    }
  } catch (err: any) {
    req.log.error({ err }, "public blog sync failed");
    const status = err instanceof PublicSyncUploadError ? err.status : 500;
    res.status(status).json({ error: err?.message ?? "Could not sync public blog" });
    return;
  }

  res.json({
    settings: settingsPayload(settings),
    posts: savedPosts.map(post => postPayload(post, true)),
  });
});

router.use(requireAuth);

router.post("/email-dashboard-link", async (req, res) => {
  const userId = (req as any).userId;
  const requestedEmail = isEmail(req.body?.email) ? req.body.email.trim() : undefined;
  const email = await accountEmailForUser(userId, requestedEmail);
  if (!isEmail(email)) {
    res.status(400).json({ error: "Account email is required" });
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: "Email is not configured" });
    return;
  }

  const subject = "Edit your Travel Bean Blog on web";
  const text = dashboardEmailBody();
  const url = dashboardUrl();
  const html = `
    <p>Open your Travel Bean dashboard from your laptop:</p>
    <p><a href="${url}">${url}</a></p>
    <p>Log in on web to edit blog posts, organise drafts, and publish your travel stories.</p>
  `;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? "Travel Bean <hello@travelbean.app>",
        to: email,
        subject,
        text,
        html,
      }),
    });
    if (!response.ok) {
      const detail = await response.text();
      req.log.error({ status: response.status, detail }, "dashboard link email send failed");
      res.status(502).json({ error: "Email send failed" });
      return;
    }
    res.json({ ok: true });
  } catch (err: any) {
    req.log.error({ err }, "dashboard link email send error");
    res.status(502).json({ error: "Email send failed" });
  }
});

router.get("/settings", async (req, res) => {
  const userId = (req as any).userId;
  const [row] = await db.select().from(travelBlogSettings).where(eq(travelBlogSettings.userId, userId));
  res.json(settingsPayload(row) ?? null);
});

router.put("/settings", async (req, res) => {
  const userId = (req as any).userId;
  const body = req.body;
  const username = sanitizeUsername(body.username ?? "");
  if (!username) {
    res.status(400).json({ error: "Username is required" });
    return;
  }
  const [taken] = await db.select().from(travelBlogSettings).where(eq(travelBlogSettings.username, username));
  if (taken && taken.userId !== userId) {
    res.status(409).json({ error: "Username is already taken" });
    return;
  }
  const now = new Date();
  const [existing] = await db.select().from(travelBlogSettings).where(eq(travelBlogSettings.userId, userId));
  if (existing) {
    const [row] = await db.update(travelBlogSettings)
      .set({
        username,
        title: body.title ?? existing.title,
        intro: body.intro ?? existing.intro,
        privacy: body.privacy ?? existing.privacy,
        updatedAt: now,
      })
      .where(eq(travelBlogSettings.userId, userId))
      .returning();
    res.json(settingsPayload(row));
    return;
  }
  const [row] = await db.insert(travelBlogSettings).values({
    userId,
    username,
    title: body.title ?? "My Travel Bean Blog",
    intro: body.intro ?? "",
    privacy: body.privacy ?? "public",
    updatedAt: now,
  }).returning();
  res.json(settingsPayload(row));
});

router.get("/posts", async (req, res) => {
  const userId = (req as any).userId;
  const rows = await db.select().from(blogPosts).where(eq(blogPosts.userId, userId));
  res.json(rows.map(row => postPayload(row, true)));
});

router.post("/posts", async (req, res) => {
  const userId = (req as any).userId;
  const [row] = await db.insert(blogPosts).values({
    id: req.body.id ?? uid(),
    ...postValues(userId, req.body),
  }).returning();
  res.json(postPayload(row, true));
});

router.put("/posts/:id", async (req, res) => {
  const userId = (req as any).userId;
  const [existing] = await db.select().from(blogPosts).where(and(eq(blogPosts.id, req.params.id), eq(blogPosts.userId, userId)));
  if (!existing) {
    res.status(404).json({ error: "Post not found" });
    return;
  }
  const values = postValues(userId, req.body, existing);
  if (values.status === "published" && values.privacy === "password" && !values.password?.trim()) {
    res.status(400).json({ error: "A password is required before publishing a password-protected post" });
    return;
  }
  const [row] = await db.update(blogPosts)
    .set(values)
    .where(and(eq(blogPosts.id, req.params.id), eq(blogPosts.userId, userId)))
    .returning();
  res.json(postPayload(row, true));
});

router.post("/posts/:id/publish", async (req, res) => {
  const userId = (req as any).userId;
  if (!(await requirePremiumPublishing(userId, res))) return;
  const now = new Date();
  const [existing] = await db.select().from(blogPosts).where(and(eq(blogPosts.id, req.params.id), eq(blogPosts.userId, userId)));
  if (!existing) {
    res.status(404).json({ error: "Post not found" });
    return;
  }
  const nextPrivacy = req.body.privacy === "password" ? "password" : "public";
  if (nextPrivacy === "password" && !existing.password?.trim()) {
    res.status(400).json({ error: "A password is required before publishing a password-protected post" });
    return;
  }
  const publicPhotos = publicBlogPhotos(existing, { password: existing.password ?? undefined });
  const [row] = await db.update(blogPosts)
    .set({
      status: "published",
      privacy: nextPrivacy,
      coverImageUrl: publicPhotos.coverImageUrl,
      photos: publicPhotos.photos,
      updatedAt: now,
      publishedAt: now,
    })
    .where(and(eq(blogPosts.id, req.params.id), eq(blogPosts.userId, userId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Post not found" });
    return;
  }
  res.json(postPayload(row, true));
});

router.post("/posts/:id/unpublish", async (req, res) => {
  const userId = (req as any).userId;
  const [row] = await db.update(blogPosts)
    .set({ status: "draft", privacy: "private", updatedAt: new Date(), publishedAt: null })
    .where(and(eq(blogPosts.id, req.params.id), eq(blogPosts.userId, userId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Post not found" });
    return;
  }
  res.json(postPayload(row, true));
});

router.delete("/posts/:id", async (req, res) => {
  const userId = (req as any).userId;
  const [row] = await db.delete(blogPosts)
    .where(and(eq(blogPosts.id, req.params.id), eq(blogPosts.userId, userId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Post not found" });
    return;
  }
  res.json({ ok: true });
});

export default router;
