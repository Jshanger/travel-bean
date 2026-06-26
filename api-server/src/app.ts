import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import fs from "node:fs";
import path from "node:path";
import { logger } from "./lib/logger";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import healthRouter from "./routes/health";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

app.use("/api", healthRouter);
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (process.env["CLERK_SECRET_KEY"]) {
  app.use(
    clerkMiddleware((req) => ({
      publishableKey: publishableKeyFromHost(
        getClerkProxyHost(req) ?? "",
        process.env.CLERK_PUBLISHABLE_KEY,
      ),
    })),
  );
} else {
  logger.warn(
    "CLERK_SECRET_KEY is not set; authenticated API routes will return unauthorized",
  );
}

app.use("/api", router);
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found" });
});

function findWebDistDir() {
  const candidates = [
    process.env["WEB_DIST_DIR"],
    path.resolve(process.cwd(), "../bean-travel/dist"),
    path.resolve(process.cwd(), "bean-travel/dist"),
    path.resolve(__dirname, "../../bean-travel/dist"),
  ].filter(Boolean) as string[];

  return candidates.find((candidate) =>
    fs.existsSync(path.join(candidate, "index.html")),
  );
}

const webDistDir = findWebDistDir();

if (webDistDir) {
  app.use(express.static(webDistDir, { dotfiles: "allow" }));

  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(webDistDir, "index.html"));
  });
} else {
  logger.warn(
    "No web dist directory found; API server will not serve the web app",
  );
}

export default app;
