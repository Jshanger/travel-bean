import { Router } from "express";
import { randomUUID } from "crypto";
import { db, placePhotos, places } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { deleteObject, isR2Configured, loadObject, makeSignedUrl, saveObject } from "../utils/storage";

const router = Router();
router.use(requireAuth);
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const ACCOUNT_STORAGE_LIMIT_BYTES = 5 * 1024 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function uid() {
  return Date.now().toString() + Math.random().toString(36).slice(2, 9);
}

async function attachImageUrl(row: typeof placePhotos.$inferSelect) {
  try {
    return {
      ...row,
      imageUrl: isR2Configured()
        ? `/api/bean/photos/img/${encodeURIComponent(row.id)}`
        : await makeSignedUrl(row.objectPath),
    };
  } catch {
    return { ...row, imageUrl: null };
  }
}

async function storedPhotoBytesForUser(userId: string) {
  const [usage] = await db
    .select({ bytes: sql<number>`coalesce(sum(${placePhotos.byteSize}), 0)` })
    .from(placePhotos)
    .where(eq(placePhotos.userId, userId));
  return Number(usage?.bytes ?? 0);
}

// POST /photos/upload — receive raw image bytes, upload to GCS, save record
router.post("/upload", async (req, res) => {
  const userId = (req as any).userId;
  const privateDir = process.env.PRIVATE_OBJECT_DIR;
  if (!privateDir && !isR2Configured()) {
    res.status(500).json({ error: "Object storage not configured" });
    return;
  }

  const { placeId } = req.query as { placeId?: string };
  if (!placeId) { res.status(400).json({ error: "placeId required" }); return; }
  const [place] = await db.select({ id: places.id }).from(places)
    .where(and(eq(places.id, placeId), eq(places.userId, userId)));
  if (!place) { res.status(404).json({ error: "Place not found" }); return; }

  const contentType = (req.headers["content-type"] ?? "image/jpeg").split(";")[0].trim().toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
    res.status(415).json({ error: "Unsupported image type" });
    return;
  }

  // Read raw body
  const chunks: Buffer[] = [];
  let size = 0;
  let tooLarge = false;
  await new Promise<void>((resolve, reject) => {
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_IMAGE_BYTES) {
        tooLarge = true;
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", resolve);
    req.on("error", reject);
  });
  if (tooLarge) { res.status(413).json({ error: "Image is too large" }); return; }
  const imageBuffer = Buffer.concat(chunks);
  if (!imageBuffer.length) { res.status(400).json({ error: "Empty image body" }); return; }
  const currentStorageBytes = await storedPhotoBytesForUser(userId);
  if (currentStorageBytes + imageBuffer.length > ACCOUNT_STORAGE_LIMIT_BYTES) {
    res.status(413).json({ error: "Photo storage limit reached. You have used your 5GB optimized photo storage. Delete older photos or contact Travel Bean for more storage." });
    return;
  }

  const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  const objectId = randomUUID();
  const objectPath = `/objects/uploads/${objectId}.${ext}`;

  await saveObject(objectPath, imageBuffer, contentType);

  const [row] = await db.insert(placePhotos).values({
    id: uid(), userId, placeId, objectPath, byteSize: imageBuffer.length, caption: "",
  }).returning();

  res.json(await attachImageUrl(row));
});

// GET /photos/img/:id — proxy image from GCS (auth enforced)
router.get("/img/:id", async (req, res) => {
  const userId = (req as any).userId;
  const [row] = await db.select().from(placePhotos)
    .where(and(eq(placePhotos.id, req.params.id), eq(placePhotos.userId, userId)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }

  try {
    const { contentType, stream } = await loadObject(row.objectPath);
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "private, max-age=3600");
    stream.pipe(res);
  } catch (err: any) {
    req.log.error({ err }, "photo serve error");
    res.status(500).json({ error: "Could not load photo" });
  }
});

// GET /photos?placeId=xxx — list photos
router.get("/", async (req, res) => {
  const userId = (req as any).userId;
  const { placeId } = req.query;
  if (!placeId || typeof placeId !== "string") { res.status(400).json({ error: "placeId required" }); return; }
  const rows = await db.select().from(placePhotos)
    .where(and(eq(placePhotos.userId, userId), eq(placePhotos.placeId, placeId)));
  res.json(await Promise.all(rows.map(attachImageUrl)));
});

// GET /photos/all — load all photo references for the signed-in user's Journal
router.get("/all", async (req, res) => {
  const userId = (req as any).userId;
  const rows = await db.select().from(placePhotos).where(eq(placePhotos.userId, userId));
  res.json(await Promise.all(rows.map(attachImageUrl)));
});

// DELETE /photos/:id
router.delete("/:id", async (req, res) => {
  const userId = (req as any).userId;
  const [row] = await db.delete(placePhotos)
    .where(and(eq(placePhotos.id, req.params.id), eq(placePhotos.userId, userId)))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  try { await deleteObject(row.objectPath); } catch { /* ignore */ }
  res.json({ ok: true });
});

export default router;
