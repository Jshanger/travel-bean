import { Router, type IRouter } from "express";
import { objectStorageStatus } from "../utils/storage";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  res.json({ status: "ok", storage: objectStorageStatus() });
});

router.get("/healthz/storage", (_req, res) => {
  res.json({ status: "ok", storage: objectStorageStatus() });
});

export default router;
