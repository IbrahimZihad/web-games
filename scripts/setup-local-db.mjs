import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const mysql = "C:/Program Files/MySQL/MySQL Server 8.0/bin/mysql.exe";
const dataDir = resolve(root, ".runtime/mysql/data");

if (!existsSync(resolve(dataDir, "mysql"))) {
  throw new Error("Initialize the isolated MySQL data directory first.");
}

const password = randomBytes(24).toString("hex");
const sql = [
  "CREATE DATABASE IF NOT EXISTS gameportal CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;",
  "CREATE DATABASE IF NOT EXISTS gameportal_shadow CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;",
  "CREATE USER IF NOT EXISTS 'gameportal'@'127.0.0.1' IDENTIFIED BY '" + password + "';",
  "ALTER USER 'gameportal'@'127.0.0.1' IDENTIFIED BY '" + password + "';",
  "CREATE USER IF NOT EXISTS 'gameportal'@'localhost' IDENTIFIED BY '" + password + "';",
  "ALTER USER 'gameportal'@'localhost' IDENTIFIED BY '" + password + "';",
  "GRANT ALL PRIVILEGES ON gameportal.* TO 'gameportal'@'127.0.0.1';",
  "GRANT ALL PRIVILEGES ON gameportal.* TO 'gameportal'@'localhost';",
  "GRANT ALL PRIVILEGES ON gameportal_shadow.* TO 'gameportal'@'127.0.0.1';",
  "GRANT ALL PRIVILEGES ON gameportal_shadow.* TO 'gameportal'@'localhost';",
  "FLUSH PRIVILEGES;",
].join("\n");

execFileSync(mysql, ["--protocol=TCP", "-h127.0.0.1", "-P3307", "-uroot"], {
  input: sql,
  stdio: ["pipe", "pipe", "pipe"],
});

mkdirSync(resolve(root, ".runtime/mysql/tmp"), { recursive: true });
writeFileSync(
  resolve(root, ".env"),
  [
    `DATABASE_URL="mysql://gameportal:${password}@127.0.0.1:3307/gameportal"`,
    `SHADOW_DATABASE_URL="mysql://gameportal:${password}@127.0.0.1:3307/gameportal_shadow"`,
    `JWT_SECRET="${randomBytes(48).toString("hex")}"`,
    'ADMIN_EMAIL="admin@gameportal.local"',
    'ADMIN_PASSWORD="Admin@12345"',
    'NEXT_PUBLIC_APP_URL="http://localhost:3000"',
    "",
  ].join("\n"),
);

console.log("Local gameportal database and .env configured on 127.0.0.1:3307.");
