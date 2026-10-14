import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { closePool, query } from "./pool.js";
import { seedDatabase } from "./seed.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function resetDatabase() {
  const schemaPath = resolve(__dirname, "../../../database/schema.sql");
  const schemaSql = await readFile(schemaPath, "utf8");

  await query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  await query(schemaSql);
  await seedDatabase();
  console.log("Database reset and seeded successfully.");
}

if (process.argv[1] && process.argv[1].endsWith("reset.js")) {
  resetDatabase()
    .catch((error) => {
      console.error("Database reset failed:", error.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      await closePool();
    });
}
