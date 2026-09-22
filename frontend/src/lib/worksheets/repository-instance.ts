import { getPool } from "@/lib/db/pool";
import { PostgresWorksheetRepository } from "./postgres-repository";
import type { WorksheetRepository } from "./repository";

let instance: WorksheetRepository | undefined;

/** Shared PostgresWorksheetRepository for route handlers, built from the pooled connection. */
export function getWorksheetRepository(): WorksheetRepository {
  if (!instance) {
    instance = new PostgresWorksheetRepository(getPool());
  }
  return instance;
}
