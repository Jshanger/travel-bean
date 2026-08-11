/**
 * Dev seed: adds 3 sample photos to the first user's Tokyo place.
 * Run: cd artifacts/api-server && npx tsx seed-photos.mts
 */
import { Storage } from "@google-cloud/storage";
import { drizzle } from "drizzle-orm/node-postgres";
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import pg from "pg";
import https from "https";
import http from "http";

const { Pool } = pg;

const SIDECAR = "http://127.0.0.1:1106";
const PRIVATE_OBJECT_DIR = process.env.PRIVATE_OBJECT_DIR || "";
const DATABASE_URL = process.env.DATABASE_URL || "";

if (!DATABASE_URL) { console.error("DATABASE_URL not set"); process.exit(1); }
if (!PRIVATE_OBJECT_DIR) { console.error("PRIVATE_OBJECT_DIR not set"); process.exit(1); }

const pool = new Pool({ connectionString: DATABASE_URL });

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
    mod.get(url, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        resolve(fetchBuffer(res.headers.location));
        return;
      }
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    }).on("error", reject);
  });
}

const PHOTOS = [
  "https://picsum.photos/seed/beantravel1/800/600",
  "https://picsum.photos/seed/beantravel2/800/600",
  "https://picsum.photos/seed/beantravel3/800/600",
];

async function main() {
  console.log("🌱  Seeding sample photos for Tokyo...\n");

  const { rows: places } = await pool.query(
    "SELECT id, user_id FROM places WHERE LOWER(name) = 'tokyo' LIMIT 1"
  );
  if (!places.length) {
    console.error("❌  No Tokyo place found. Open the app once to trigger seed data, then re-run.");
    process.exit(1);
  }
  const { id: placeId, user_id: userId } = places[0];
  console.log(`   Place ID : ${placeId}`);
  console.log(`   User  ID : ${userId}\n`);

  // Skip already seeded
  const { rows: existing } = await pool.query(
    "SELECT id FROM place_photos WHERE place_id = $1 AND user_id = $2",
    [placeId, userId]
  );
  if (existing.length >= 3) {
    console.log(`✅  Tokyo already has ${existing.length} photo(s) — nothing to do.`);
    await pool.end(); return;
  }

  for (let i = 0; i < PHOTOS.length; i++) {
    const url = PHOTOS[i];
    console.log(`   [${i + 1}/3] Downloading ${url} ...`);
    const buf = await fetchBuffer(url);
    console.log(`         ${buf.length} bytes received`);

    const photoId = uid();
    const objectPath = `/objects/uploads/${photoId}.jpg`;

    console.log(`         Uploading to GCS...`);
    const file = getGcsFile(objectPath);
    await file.save(buf, { contentType: "image/jpeg" });

    await pool.query(
      `INSERT INTO place_photos (id, user_id, place_id, object_path, caption, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [photoId, userId, placeId, objectPath, `Sample photo ${i + 1}`]
    );
    console.log(`         ✓ Saved (id: ${photoId})\n`);
  }

  console.log("✅  Done! Open Tokyo → camera icon in the app to see the photos & collage builder.");
  await pool.end();
}

main().catch((err) => {
  console.error("❌  Failed:", err.message || err);
  process.exit(1);
});
