import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { closePool, query } from "./pool.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function initDatabase() {
  const schemaPath = resolve(__dirname, "../../../database/schema.sql");
  const schemaSql = await readFile(schemaPath, "utf8");

  await query(schemaSql);
  console.log("Database schema created successfully.");
}

initDatabase()
  .catch((error) => {
    console.error("Database initialization failed:");
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
