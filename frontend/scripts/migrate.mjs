// Minimal SQL migration runner: applies migrations/*.sql in filename order,
// each in its own transaction, and records applied files in schema_migrations.
// Re-running is safe: already-applied files are skipped.
// Usage: DATABASE_URL=postgresql://... npm run db:migrate
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "migrations");
const client = new pg.Client({ connectionString: databaseUrl });

try {
  await client.connect();
  await client.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       name       TEXT        PRIMARY KEY,
       applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
     )`,
  );
  const { rows } = await client.query("SELECT name FROM schema_migrations");
  const applied = new Set(rows.map((row) => row.name));

  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  let count = 0;
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(path.join(dir, file), "utf8");
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
    console.log(`applied ${file}`);
    count += 1;
  }
  console.log(count === 0 ? "No pending migrations." : `Applied ${count} migration(s).`);
} catch (error) {
  console.error("Migration failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await client.end();
}
