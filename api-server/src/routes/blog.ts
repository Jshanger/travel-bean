import { Router } from "express";
import { db, blogPosts, placePhotos, travelBlogSettings } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { loadObject } from "../utils/storage";

const router = Router();

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

function postValues(userId: string, body: any, existing?: typeof blogPosts.$inferSelect) {
  const now = new Date();
  return {
    userId,
    sourcePlaceId: body.sourcePlaceId ?? existing?.sourcePlaceId ?? "",
    status: body.status ?? existing?.status ?? "draft",
    privacy: body.privacy ?? existing?.privacy ?? "private",
    password: body.password ?? existing?.password ?? null,
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
    publishedAt: body.publishedAt ? new Date(body.publishedAt) : existing?.publishedAt ?? null,
  };
}

function publicImagePath(photoId: string) {
  return `/api/blog/public/images/${encodeURIComponent(photoId)}`;
}

function publicBlogPhotos(post: typeof blogPosts.$inferSelect, publicOnly = false) {
  if (publicOnly && post.privacy !== "public") {
    return {
      coverImageUrl: post.coverImageUrl,
      photos: Array.isArray(post.photos) ? post.photos : [],
    };
  }
  const photos = (Array.isArray(post.photos) ? post.photos : []).map((photo: any) => ({
    ...photo,
    imageUrl: photo?.id ? publicImagePath(photo.id) : photo?.imageUrl,
  }));
  return {
    coverImageUrl: post.coverPhotoId ? publicImagePath(post.coverPhotoId) : post.coverImageUrl,
    photos,
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

function dashboardEmailBody() {
  return [
    "Open your Travel Bean dashboard from your laptop:",
    "",
    "https://travelbean.app/dashboard",
    "",
    "Log in with the same account you use in the Travel Bean app to edit your blog posts, organise drafts, and publish your travel stories.",
  ].join("\n");
}

async function canServePublicPhoto(photoId: string) {
  const posts = await db.select().from(blogPosts).where(and(
    eq(blogPosts.status, "published"),
    eq(blogPosts.privacy, "public"),
  ));
  for (const post of posts) {
    if (post.coverPhotoId === photoId) return post.userId;
    const photos = Array.isArray(post.photos) ? post.photos : [];
    if (photos.some((photo: any) => photo?.id === photoId && photo?.included !== false)) {
      return post.userId;
    }
  }
  return null;
}

router.get("/public/images/:photoId", async (req, res) => {
  const userId = await canServePublicPhoto(req.params.photoId);
  if (!userId) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [row] = await db.select().from(placePhotos).where(and(
    eq(placePhotos.id, req.params.photoId),
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
      .map(post => ({
        ...postPayload(post, false),
        ...publicBlogPhotos(post, true),
      })),
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
  if (post.privacy === "password" && req.query.password !== post.password) {
    res.json({
      settings: settingsPayload(settings),
      post: {
        ...postPayload(post, false),
        body: "",
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
      ...publicBlogPhotos(post),
    },
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
  const html = `
    <p>Open your Travel Bean dashboard from your laptop:</p>
    <p><a href="https://travelbean.app/dashboard">https://travelbean.app/dashboard</a></p>
    <p>Log in with the same account you use in the Travel Bean app to edit your blog posts, organise drafts, and publish your travel stories.</p>
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
  const [row] = await db.update(blogPosts)
    .set(postValues(userId, req.body, existing))
    .where(and(eq(blogPosts.id, req.params.id), eq(blogPosts.userId, userId)))
    .returning();
  res.json(postPayload(row, true));
});

router.post("/posts/:id/publish", async (req, res) => {
  const userId = (req as any).userId;
  const now = new Date();
  const [existing] = await db.select().from(blogPosts).where(and(eq(blogPosts.id, req.params.id), eq(blogPosts.userId, userId)));
  if (!existing) {
    res.status(404).json({ error: "Post not found" });
    return;
  }
  const publicPhotos = publicBlogPhotos(existing);
  const [row] = await db.update(blogPosts)
    .set({
      status: "published",
      privacy: req.body.privacy === "password" ? "password" : "public",
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
