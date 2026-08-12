import { spawnSync } from "node:child_process";

function stripProtocol(domain) {
  const value = domain.trim();
  if (!value) return "";
  return value.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
}

const domain = stripProtocol(
  process.env.EXPO_PUBLIC_DOMAIN ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL ||
    "",
);

if (!domain) {
  console.error(
    "EXPO_PUBLIC_DOMAIN is required for web builds. Set it to your Vercel domain, for example travel-bean.vercel.app.",
  );
  process.exit(1);
}

const env = {
  ...process.env,
  EXPO_PUBLIC_DOMAIN: domain,
  EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY:
    process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ||
    process.env.CLERK_PUBLISHABLE_KEY ||
    "",
  EXPO_PUBLIC_CLERK_PROXY_URL:
    process.env.EXPO_PUBLIC_CLERK_PROXY_URL ||
    process.env.CLERK_PROXY_URL ||
    "",
};

console.log(`Building Travel Bean web for ${domain}`);

const result = spawnSync(
  "pnpm",
  ["--dir", "bean-travel", "exec", "expo", "export", "--platform", "web", "--output-dir", "dist", "--clear"],
  {
    cwd: process.cwd(),
    env,
    stdio: "inherit",
  },
);

process.exit(result.status ?? 1);
