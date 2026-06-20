import { spawnSync } from "node:child_process";

const migration = spawnSync("corepack", ["pnpm", "--dir", "lib-db", "run", "push"], {
  cwd: process.cwd(),
  stdio: "inherit",
});

if (migration.status !== 0) {
  process.exit(migration.status ?? 1);
}

await import("./dist/index.mjs");
