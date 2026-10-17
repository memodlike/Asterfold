import { WorkspaceLimitError } from "../domain/errors";
import { IMPORT_LIMITS } from "../domain/importLimits";
import type { AsterfoldDatabase } from "./database";

// Call inside the insertion transaction. Trash is also retained in backups.
export async function assertCapacity(
  database: AsterfoldDatabase,
  kind: "pages" | "boards" | "bookmarks",
  additional: number,
): Promise<void> {
  if (additional > 0 && await database[kind].count() + additional > IMPORT_LIMITS[kind]) {
    throw new WorkspaceLimitError();
  }
}
