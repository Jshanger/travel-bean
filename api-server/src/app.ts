import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import fs from "node:fs";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { db, blogPosts, travelBlogSettings } from "@workspace/db";
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
  app.get(/^\/@[a-zA-Z0-9_]+(?:\/[^/?#]+)?$/, async (req, res, next) => {
    try {
      const html = await publicBlogHtml(req, webDistDir);
      if (!html) {
        next();
        return;
      }
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=60");
      res.send(html);
    } catch (err) {
      req.log.error({ err }, "public blog metadata render error");
      next();
    }
  });

  app.use(express.static(webDistDir, { dotfiles: "allow" }));

  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(webDistDir, "index.html"));
  });
} else {
  logger.warn(
    "No web dist directory found; API server will not serve the web app",
  );
}

type ShareMeta = {
  title: string;
  description: string;
  url: string;
  imageUrl?: string;
};

function sanitizeBlogUsername(value: string) {
  return value
    .trim()
    .replace(/^@+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 24);
}

function requestOrigin(req: express.Request) {
  const host = req.get("x-forwarded-host") ?? req.get("host") ?? "travel-bean-production.up.railway.app";
  const proto = req.get("x-forwarded-proto") ?? req.protocol ?? "https";
  return `${proto}://${host}`;
}

function absoluteUrl(req: express.Request, value: string) {
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/")) return `${requestOrigin(req)}${value}`;
  return `${requestOrigin(req)}/${value.replace(/^\/+/, "")}`;
}

function cleanDescription(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 220);
}

function imageForShare(req: express.Request, post: typeof blogPosts.$inferSelect) {
  if (post.privacy === "password" || post.privacy === "private") return undefined;
  if (post.coverImageUrl && /^https?:\/\//i.test(post.coverImageUrl)) return post.coverImageUrl;
  if (post.coverImageUrl?.startsWith("/")) return absoluteUrl(req, post.coverImageUrl);
  if (post.coverPhotoId) return absoluteUrl(req, `/api/blog/public/images/${encodeURIComponent(post.coverPhotoId)}`);
  return undefined;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function metaTags(meta: ShareMeta) {
  const tags = [
    `<title>${escapeHtml(meta.title)}</title>`,
    `<meta name="description" content="${escapeHtml(meta.description)}" />`,
    `<link rel="canonical" href="${escapeHtml(meta.url)}" />`,
    `<meta property="og:type" content="article" />`,
    `<meta property="og:site_name" content="Travel Bean" />`,
    `<meta property="og:title" content="${escapeHtml(meta.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(meta.description)}" />`,
    `<meta property="og:url" content="${escapeHtml(meta.url)}" />`,
    `<meta name="twitter:card" content="${meta.imageUrl ? "summary_large_image" : "summary"}" />`,
    `<meta name="twitter:title" content="${escapeHtml(meta.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(meta.description)}" />`,
  ];
  if (meta.imageUrl) {
    tags.push(`<meta property="og:image" content="${escapeHtml(meta.imageUrl)}" />`);
    tags.push(`<meta property="og:image:alt" content="${escapeHtml(meta.title)}" />`);
    tags.push(`<meta name="twitter:image" content="${escapeHtml(meta.imageUrl)}" />`);
  }
  return tags.join("\n    ");
}

async function publicBlogMeta(req: express.Request): Promise<ShareMeta | null> {
  const pathParts = req.path.split("/").filter(Boolean);
  const username = sanitizeBlogUsername(pathParts[0] ?? "");
  const slug = pathParts[1];
  if (!username) return null;

  const [settings] = await db.select().from(travelBlogSettings).where(eq(travelBlogSettings.username, username));
  if (!settings || settings.privacy === "private") return null;

  const url = absoluteUrl(req, req.originalUrl.split("?")[0] ?? req.path);
  if (slug) {
    const [post] = await db.select().from(blogPosts).where(and(
      eq(blogPosts.userId, settings.userId),
      eq(blogPosts.slug, slug),
      eq(blogPosts.status, "published"),
    ));
    if (!post || post.privacy === "private") return null;
    const description = post.privacy === "password"
      ? `${post.title} is a password-protected story on Travel Bean.`
      : cleanDescription(post.subtitle || post.opening || post.body || `${post.place}, ${post.country}`);
    return {
      title: `${post.title} | Travel Bean`,
      description,
      url,
      imageUrl: imageForShare(req, post),
    };
  }

  const posts = await db.select().from(blogPosts).where(and(
    eq(blogPosts.userId, settings.userId),
    eq(blogPosts.status, "published"),
  ));
  const previewPost = posts.find(post => post.privacy === "public" && imageForShare(req, post));
  return {
    title: `${settings.title || `@${username}`} | Travel Bean`,
    description: cleanDescription(settings.intro || `Read ${settings.title || `@${username}`}'s Travel Bean Blog.`),
    url,
    imageUrl: previewPost ? imageForShare(req, previewPost) : undefined,
  };
}

async function publicBlogHtml(req: express.Request, webDistDir: string) {
  const meta = await publicBlogMeta(req);
  if (!meta) return null;
  const indexPath = path.join(webDistDir, "index.html");
  const html = await fs.promises.readFile(indexPath, "utf8");
  const withoutDefaultTitle = html.replace(/<title>.*?<\/title>/i, "");
  return withoutDefaultTitle.replace("<head>", `<head>\n    ${metaTags(meta)}`);
}

export default app;
