import { Storage } from "@google-cloud/storage";
import { createHash, createHmac } from "node:crypto";
import { Readable } from "node:stream";

const SIDECAR = "http://127.0.0.1:1106";

export const gcs = new Storage({
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
  },
  projectId: "",
});

export function parseGcsPath(raw: string): { bucketName: string; objectName: string } {
  const normalized = raw.startsWith("gs://") ? raw.slice(5) : raw;
  const slash = normalized.indexOf("/");
  if (slash === -1) return { bucketName: normalized, objectName: "" };
  return { bucketName: normalized.slice(0, slash), objectName: normalized.slice(slash + 1) };
}

export function getGcsFile(objectPath: string) {
  const privateDir = process.env.PRIVATE_OBJECT_DIR || "";
  if (!objectPath.startsWith("/objects/")) throw new Error("Invalid path");
  const entityId = objectPath.slice("/objects/".length);
  const dir = privateDir.endsWith("/") ? privateDir : `${privateDir}/`;
  const { bucketName, objectName } = parseGcsPath(`${dir}${entityId}`);
  return gcs.bucket(bucketName).file(objectName);
}

function getObjectName(objectPath: string) {
  if (!objectPath.startsWith("/objects/")) throw new Error("Invalid path");
  return objectPath.slice("/objects/".length);
}

function r2Config() {
  const endpoint = process.env.R2_ENDPOINT || (
    process.env.R2_ACCOUNT_ID
      ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
      : ""
  );
  const bucket = process.env.R2_BUCKET_NAME;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null;
  return {
    endpoint: endpoint.replace(/\/+$/, ""),
    bucket,
    accessKeyId,
    secretAccessKey,
  };
}

export function isR2Configured() {
  return Boolean(r2Config());
}

function hmac(key: Buffer | string, value: string) {
  return createHmac("sha256", key).update(value).digest();
}

function hexHash(value: Buffer | string) {
  return createHash("sha256").update(value).digest("hex");
}

function amzDate(now = new Date()) {
  return now.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function signR2Request(method: string, objectPath: string, body: Buffer | null, contentType?: string) {
  const config = r2Config();
  if (!config) throw new Error("R2 storage not configured");

  const objectName = getObjectName(objectPath);
  const encodedObjectName = objectName.split("/").map(encodeURIComponent).join("/");
  const url = new URL(`${config.endpoint}/${config.bucket}/${encodedObjectName}`);
  const host = url.host;
  const timestamp = amzDate();
  const date = timestamp.slice(0, 8);
  const region = "auto";
  const service = "s3";
  const payloadHash = hexHash(body ?? "");
  const headers: Record<string, string> = {
    host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": timestamp,
  };
  if (contentType) headers["content-type"] = contentType;

  const signedHeaders = Object.keys(headers).sort().join(";");
  const canonicalHeaders = Object.keys(headers)
    .sort()
    .map(key => `${key}:${headers[key]}\n`)
    .join("");
  const canonicalRequest = [
    method,
    url.pathname,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const credentialScope = `${date}/${region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    timestamp,
    credentialScope,
    hexHash(canonicalRequest),
  ].join("\n");
  const signingKey = hmac(
    hmac(hmac(hmac(`AWS4${config.secretAccessKey}`, date), region), service),
    "aws4_request",
  );
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");

  return {
    url,
    headers: {
      ...headers,
      Authorization: `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
  };
}

async function r2Fetch(method: string, objectPath: string, body: Buffer | null = null, contentType?: string) {
  const signed = signR2Request(method, objectPath, body, contentType);
  const response = await fetch(signed.url, {
    method,
    headers: signed.headers,
    body: body as any,
  });
  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(`R2 ${method} failed (${response.status}): ${message}`);
  }
  return response;
}

export async function saveObject(objectPath: string, imageBuffer: Buffer, contentType: string) {
  if (isR2Configured()) {
    await r2Fetch("PUT", objectPath, imageBuffer, contentType);
    return;
  }
  await getGcsFile(objectPath).save(imageBuffer, { contentType, resumable: false });
}

export async function deleteObject(objectPath: string) {
  if (isR2Configured()) {
    await r2Fetch("DELETE", objectPath).catch(() => undefined);
    return;
  }
  await getGcsFile(objectPath).delete({ ignoreNotFound: true });
}

export async function loadObject(objectPath: string) {
  if (isR2Configured()) {
    const response = await r2Fetch("GET", objectPath);
    if (!response.body) throw new Error("R2 object response was empty");
    return {
      contentType: response.headers.get("content-type") || contentTypeFromPath(objectPath),
      stream: Readable.fromWeb(response.body as any),
    };
  }
  const file = getGcsFile(objectPath);
  const [metadata] = await file.getMetadata();
  return {
    contentType: (metadata.contentType as string) || contentTypeFromPath(objectPath),
    stream: file.createReadStream(),
  };
}

function contentTypeFromPath(objectPath: string) {
  const clean = objectPath.split("?")[0].toLowerCase();
  if (clean.endsWith(".png")) return "image/png";
  if (clean.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

export async function makeSignedUrl(objectPath: string): Promise<string> {
  if (isR2Configured()) {
    const publicUrl = process.env.R2_PUBLIC_URL;
    if (publicUrl) {
      return `${publicUrl.replace(/\/+$/, "")}/${getObjectName(objectPath)}`;
    }
  }
  const file = getGcsFile(objectPath);
  const [url] = await file.getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + 60 * 60 * 1000,
  });
  return url;
}
