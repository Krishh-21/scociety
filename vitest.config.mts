import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    env: { DATABASE_URL: "", VERCEL: "", JODO_AUTH_MODE: "demo" },
    include: ["tests/**/*.test.ts"],
    // The SQLite connection is process-global, so keep test files in separate workers.
    pool: "forks",
    maxWorkers: 3,
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
});
