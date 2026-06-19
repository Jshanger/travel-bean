import { Router, type IRouter } from "express";
import healthRouter from "./health";
import beanRouter from "./bean";
import photosRouter from "./photos";
import privacyRouter from "./privacy";
import entitlementsRouter from "./entitlements";
import transcribeRouter from "./transcribe";
import devSeedRouter from "./dev-seed";
import blogRouter from "./blog";

const router: IRouter = Router();

router.use(healthRouter);
router.use(privacyRouter);
router.use("/bean", beanRouter);
router.use("/bean/photos", photosRouter);
router.use("/bean/entitlements", entitlementsRouter);
router.use("/bean/transcribe", transcribeRouter);
router.use("/blog", blogRouter);
router.use("/dev", devSeedRouter);

export default router;
