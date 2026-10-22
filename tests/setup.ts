import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// 1. Enforce test environment
(process.env as Record<string, string | undefined>).NODE_ENV = "test";

// 2. Enforce dedicated test database URL (never dev.db)
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("dev.db")) {
  process.env.DATABASE_URL = "file:./test.db?connection_limit=1&socket_timeout=30";
}

// 3. Fallback secret for test run if not configured
process.env.AUTH_SECRET =
  process.env.AUTH_SECRET || "spanqc_test_secret_0123456789abcdef0123456789abcdef";

// 4. Ensure test database exists and schema is in sync
const testDbPath = path.resolve(process.cwd(), "prisma/test.db");
if (!fs.existsSync(testDbPath)) {
  execSync("npx prisma db push --skip-generate", {
    stdio: "ignore",
    env: { ...process.env, DATABASE_URL: "file:./test.db" },
  });
}
