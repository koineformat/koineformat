/**
 * The bridge between a lockfile row and the bytes on disk. `inspectOnDisk` is the
 * single, fully-offline (U7) source of truth for "does the vendored tree still
 * match the lock?" — used by verify, list, install, and update alike, so every
 * command agrees on what "modified" means.
 *
 * It reads the tree and hands it to `core/verify.ts`, which does the actual
 * comparison; the one verdict this layer adds is the one the core cannot know —
 * "missing", i.e. there is no tree at all.
 */
import { join } from "node:path";
import type { LockEntry } from "./core/types.js";
import { KNOWLEDGE_DIR } from "./core/types.js";
import { isKoineError } from "./core/errors.js";
import { inspectFiles, type PackageInspection, type PackageStatus } from "./core/verify.js";
import { pathExists, readTree } from "./fsx.js";

export { changedFiles } from "./core/verify.js";

/** The conventional vendor directory for a package installed under `name`. */
export function defaultDir(name: string): string {
  return `${KNOWLEDGE_DIR}/${name}`;
}

export type OnDiskStatus = PackageStatus | "missing";

export interface OnDiskInspection extends Omit<PackageInspection, "status"> {
  status: OnDiskStatus;
}

/**
 * Inspect a vendored package against its lock row, offline. "ok" means every
 * file matches its manifest hash *and* the manifest fingerprint matches the
 * lock. "modified" means the tree drifted (local edits, U5). "missing" means the
 * directory is gone; "error" means the package is unreadable.
 */
export async function inspectOnDisk(cwd: string, entry: LockEntry): Promise<OnDiskInspection> {
  const abs = join(cwd, entry.dir);
  if (!(await pathExists(abs))) return { status: "missing" };
  let files: Map<string, Uint8Array>;
  try {
    files = await readTree(abs);
  } catch (e) {
    return { status: "error", message: isKoineError(e) ? e.message : String(e) };
  }
  return inspectFiles(files, { where: entry.dir, expectedIntegrity: entry.integrity });
}
