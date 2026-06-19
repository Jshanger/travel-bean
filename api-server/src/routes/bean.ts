import { Router } from "express";
import { db, places, bucketItems, trips, placePhotos } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { getGcsFile, makeSignedUrl } from "../utils/storage";

const router = Router();

// All routes require auth — collaboration is app-to-app between Bean users
router.use(requireAuth);

router.get("/share/:shareId", async (req, res) => {
  const rows = await db.select().from(trips).where(eq(trips.shareId, req.params.shareId));
  if (!rows[0]) { res.status(404).json({ error: "Trip not found" }); return; }
  res.json(rows[0]);
});

router.post("/share/:shareId/vote", async (req, res) => {
  const { itemId, vote } = req.body as { itemId?: string; vote?: string };
  if (!itemId || !['mustGo', 'maybe', 'skip'].includes(vote ?? '')) {
    res.status(400).json({ error: "Invalid vote payload" }); return;
  }
  const rows = await db.select().from(trips).where(eq(trips.shareId, req.params.shareId));
  const trip = rows[0];
  if (!trip) { res.status(404).json({ error: "Trip not found" }); return; }

  const itinerary = (Array.isArray(trip.itinerary) ? trip.itinerary as any[] : []).map(item => {
    if (item.id !== itemId) return item;
    return { ...item, votes: { ...item.votes, [vote!]: (item.votes?.[vote!] ?? 0) + 1 } };
  });
  const [updated] = await db.update(trips).set({ itinerary }).where(eq(trips.shareId, req.params.shareId)).returning();
  res.json({ ok: true, itinerary: updated.itinerary });
});

function uid() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

// ── Places ──────────────────────────────────────────────
router.get("/places", async (req, res) => {
  const userId = (req as any).userId;
  const rows = await db.select().from(places).where(eq(places.userId, userId));
  res.json(rows);
});

router.post("/places", async (req, res) => {
  const userId = (req as any).userId;
  const body = req.body;
  const [row] = await db.insert(places).values({
    id: uid(),
    userId,
    name: body.name,
    country: body.country,
    city: body.city ?? null,
    category: body.category,
    dateVisited: body.dateVisited ?? "",
    notes: body.notes ?? "",
    latitude: body.latitude ?? null,
    longitude: body.longitude ?? null,
  }).returning();
  res.json(row);
});

router.put("/places/:id", async (req, res) => {
  const userId = (req as any).userId;
  const body = req.body;
  const [row] = await db.update(places)
    .set({
      name: body.name,
      country: body.country,
      city: body.city ?? null,
      category: body.category,
      dateVisited: body.dateVisited,
      notes: body.notes,
      latitude: body.latitude,
      longitude: body.longitude,
    })
    .where(and(eq(places.id, req.params.id), eq(places.userId, userId)))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.delete("/places/:id", async (req, res) => {
  const userId = (req as any).userId;
  const photos = await db.select().from(placePhotos)
    .where(and(eq(placePhotos.placeId, req.params.id), eq(placePhotos.userId, userId)));
  await db.delete(placePhotos)
    .where(and(eq(placePhotos.placeId, req.params.id), eq(placePhotos.userId, userId)));
  const [row] = await db.delete(places).where(and(eq(places.id, req.params.id), eq(places.userId, userId))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await Promise.all(photos.map(photo => getGcsFile(photo.objectPath).delete({ ignoreNotFound: true }).catch(() => undefined)));
  res.json({ ok: true });
});


// ── Bucket items ──────────────────────────────────────────────
async function attachBucketImageUrl(row: typeof bucketItems.$inferSelect) {
  if (!row.imageObjectPath) return { ...row, imageUrl: row.imageUrl ?? null };
  try {
    const imageUrl = await makeSignedUrl(row.imageObjectPath);
    return { ...row, imageUrl };
  } catch {
    return { ...row, imageUrl: null };
  }
}

router.get("/bucket", async (req, res) => {
  const userId = (req as any).userId;
  const rows = await db.select().from(bucketItems).where(eq(bucketItems.userId, userId));
  const withUrls = await Promise.all(rows.map(attachBucketImageUrl));
  res.json(withUrls);
});

router.post("/bucket", async (req, res) => {
  const userId = (req as any).userId;
  const body = req.body;
  const [row] = await db.insert(bucketItems).values({
    id: uid(),
    userId,
    name: body.name,
    location: body.location,
    country: body.country ?? null,
    source: body.source,
    tags: body.tags ?? [],
    status: body.status,
    notes: body.notes ?? "",
    imageUrl: body.imageUrl ?? null,
    imageObjectPath: body.imageObjectPath ?? null,
  }).returning();
  res.json(await attachBucketImageUrl(row));
});

router.put("/bucket/:id", async (req, res) => {
  const userId = (req as any).userId;
  const body = req.body;
  const updateSet: Record<string, unknown> = {
    name: body.name,
    location: body.location,
    country: body.country ?? null,
    source: body.source,
    tags: body.tags,
    status: body.status,
    notes: body.notes,
    imageUrl: body.imageUrl ?? null,
  };
  if (body.imageObjectPath !== undefined) {
    updateSet.imageObjectPath = body.imageObjectPath;
  }
  const [row] = await db.update(bucketItems)
    .set(updateSet as any)
    .where(and(eq(bucketItems.id, req.params.id), eq(bucketItems.userId, userId)))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(await attachBucketImageUrl(row));
});

router.delete("/bucket/:id", async (req, res) => {
  const userId = (req as any).userId;
  const [row] = await db.delete(bucketItems).where(and(eq(bucketItems.id, req.params.id), eq(bucketItems.userId, userId))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ok: true });
});

// ── Trips ──────────────────────────────────────────────
router.get("/trips", async (req, res) => {
  const userId = (req as any).userId;
  const rows = await db.select().from(trips).where(eq(trips.userId, userId));
  res.json(rows);
});

router.post("/trips", async (req, res) => {
  const userId = (req as any).userId;
  const body = req.body;
  const id = uid();
  const [row] = await db.insert(trips).values({
    id,
    userId,
    name: body.name,
    destination: body.destination,
    startDate: body.startDate,
    endDate: body.endDate,
    travellers: body.travellers ?? [],
    itinerary: [],
    shareId: `bean-trip-${id}`,
  }).returning();
  res.json(row);
});

router.put("/trips/:id", async (req, res) => {
  const userId = (req as any).userId;
  const body = req.body;
  const [row] = await db.update(trips)
    .set({ name: body.name, destination: body.destination, startDate: body.startDate, endDate: body.endDate, travellers: body.travellers, itinerary: body.itinerary })
    .where(and(eq(trips.id, req.params.id), eq(trips.userId, userId)))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.delete("/trips/:id", async (req, res) => {
  const userId = (req as any).userId;
  const [row] = await db.delete(trips).where(and(eq(trips.id, req.params.id), eq(trips.userId, userId))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ok: true });
});

export default router;
