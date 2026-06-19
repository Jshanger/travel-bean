import { Router } from "express";
import { db, userSubscriptions } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

export function isProActive(
  sub: { isPro: boolean; proUntil: Date | null } | undefined
): boolean {
  if (!sub?.isPro) return false;
  if (!sub.proUntil) return true;
  return sub.proUntil > new Date();
}

// GET /entitlements
router.get("/", async (req, res) => {
  const userId = (req as any).userId;
  const [sub] = await db
    .select()
    .from(userSubscriptions)
    .where(eq(userSubscriptions.userId, userId));
  res.json({ isPro: isProActive(sub) });
});

// POST /entitlements/activate  — called by RevenueCat webhook or dev test
router.post("/activate", async (req, res) => {
  const userId = (req as any).userId;
  const proUntil = req.body?.proUntil ? new Date(req.body.proUntil) : null;
  await db
    .insert(userSubscriptions)
    .values({ userId, isPro: true, proSince: new Date(), proUntil })
    .onConflictDoUpdate({
      target: userSubscriptions.userId,
      set: { isPro: true, proSince: new Date(), proUntil },
    });
  res.json({ ok: true });
});

// POST /entitlements/revoke  — for testing
router.post("/revoke", async (req, res) => {
  const userId = (req as any).userId;
  await db
    .update(userSubscriptions)
    .set({ isPro: false })
    .where(eq(userSubscriptions.userId, userId));
  res.json({ ok: true });
});

export default router;
