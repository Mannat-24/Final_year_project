import fs from "fs";
import path from "path";
import pg from "pg";
import { fileURLToPath } from "url";
import { env } from "./env.js";

const { Pool } = pg;

const pool = new Pool({
  connectionString: env.postgresUri,
  ssl: env.postgresSsl ? { rejectUnauthorized: false } : undefined,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const schemaFilePath = path.resolve(__dirname, "../../sql/postgres_schema.sql");

export const query = (text, params = []) => pool.query(text, params);

export const withTransaction = async (handler) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await handler(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const connectDb = async () => {
  await pool.query("SELECT 1");

  const schemaSql = fs.readFileSync(schemaFilePath, "utf8");
  await pool.query(schemaSql);

  console.log("PostgreSQL connected and schema initialized");
};

export const db = {
  query,
  withTransaction,
  pool
};
