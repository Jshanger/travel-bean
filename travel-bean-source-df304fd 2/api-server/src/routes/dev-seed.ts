/**
 * DEV-ONLY: seed 3 sample photos for the first user's Tokyo place.
 * Disabled in production.
 */
import { Router } from "express";
import { Storage } from "@google-cloud/storage";
import { db, placePhotos } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import https from "https";
import http from "http";

const router = Router();

if (process.env.NODE_ENV !== "production") {
  const SIDECAR = "http://127.0.0.1:1106";
  const PRIVATE_OBJECT_DIR = process.env.PRIVATE_OBJECT_DIR || "";

  const gcs = new Storage({
    credentials: {
      audience: "replit",
      subject_token_type: "access_token",
      token_url: `${SIDECAR}/token`,
      type: "external_account",
      credential_source: {
        url: `${SIDECAR}/credential`,
        format: { type: "json", subject_token_field_name: "access_token" },
      },
      universe_domain: "googleapis.com",
    } as any,
    projectId: "",
  });

  function parseObjectPath(path: string) {
    const n = path.startsWith("/") ? path : `/${path}`;
    const parts = n.split("/");
    return { bucketName: parts[1], objectName: parts.slice(2).join("/") };
  }

  function getGcsFile(objectPath: string) {
    const entityId = objectPath.slice("/objects/".length);
    const dir = PRIVATE_OBJECT_DIR.endsWith("/") ? PRIVATE_OBJECT_DIR : `${PRIVATE_OBJECT_DIR}/`;
    const { bucketName, objectName } = parseObjectPath(`${dir}${entityId}`);
    return gcs.bucket(bucketName).file(objectName);
  }

  function uid() { return Date.now().toString() + Math.random().toString(36).slice(2, 9); }

  function fetchBuffer(url: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const mod = url.startsWith("https") ? https : http;
      mod.get(url, (res: any) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          resolve(fetchBuffer(res.headers.location)); return;
        }
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
        res.on("error", reject);
      }).on("error", reject);
    });
  }

  // POST /dev/seed-photos — seeds 3 photos for first user's Tokyo place
  router.post("/seed-photos", async (req, res) => {
    try {
      // Find first Tokyo place
      const { rows: places } = await (db as any).$client.query(
        "SELECT id, user_id FROM places WHERE LOWER(name) = 'tokyo' LIMIT 1"
      );
      if (!places.length) {
        res.status(404).json({ error: "No Tokyo place found — open the app first to seed data" });
        return;
      }
      const { id: placeId, user_id: userId } = places[0];

      // Check existing
      const existing = await db.select().from(placePhotos)
        .where(and(eq(placePhotos.placeId, placeId), eq(placePhotos.userId, userId)));
      if (existing.length >= 3) {
        res.json({ ok: true, message: `Already has ${existing.length} photos`, photoIds: existing.map(p => p.id) });
        return;
      }

      const SAMPLE_URLS = [
        "https://picsum.photos/seed/bean1/800/600",
        "https://picsum.photos/seed/bean2/800/600",
        "https://picsum.photos/seed/bean3/800/600",
      ];

      const added: string[] = [];
      for (let i = 0; i < SAMPLE_URLS.length; i++) {
        const buf = await fetchBuffer(SAMPLE_URLS[i]);
        const photoId = uid();
        const objectPath = `/objects/uploads/${photoId}.jpg`;
        const file = getGcsFile(objectPath);
        await file.save(buf, { contentType: "image/jpeg" });
        const [row] = await db.insert(placePhotos).values({
          id: photoId,
          userId,
          placeId,
          objectPath,
          caption: `Sample photo ${i + 1}`,
        }).returning();
        added.push(row.id);
      }

      res.json({ ok: true, message: `Added ${added.length} photos to Tokyo`, photoIds: added, placeId, userId });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}

export default router;
