import "../config/env.js";
import pg from "pg";

const { Pool } = pg;

// Hosted Postgres (Neon, Supabase, RDS, AWS, etc.) requires SSL
const isHostedDatabase = Boolean(
  process.env.DATABASE_URL &&
    !process.env.DATABASE_URL.includes("localhost") &&
    !process.env.DATABASE_URL.includes("127.0.0.1")
);

const sslConfig =
  process.env.PGSSLMODE === "disable"
    ? false
    : isHostedDatabase || process.env.DATABASE_SSL === "true"
    ? { rejectUnauthorized: false }
    : undefined;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslConfig,
});

export function query(sql, params) {
  return pool.query(sql, params);
}

export function getClient() {
  return pool.connect();
}

export async function closePool() {
  await pool.end();
}