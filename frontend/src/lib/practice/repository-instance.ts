import { getPool } from "@/lib/db/pool";
import { PostgresPracticeRepository } from "./postgres-repository";
import type { PracticeRepository } from "./repository";

let instance: PracticeRepository | undefined;

/** Shared PostgresPracticeRepository for route handlers, built from the pooled connection. */
export function getPracticeRepository(): PracticeRepository {
  if (!instance) {
    instance = new PostgresPracticeRepository(getPool());
  }
  return instance;
}
