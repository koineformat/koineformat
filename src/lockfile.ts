/**
 * Reading and writing the consumer's `knowledge/.koine-lock.json`. The lockfile's
 * *shape* — how a row is built, normalized, and rendered — lives in
 * `core/lock.ts`, which a Worker can use without a filesystem; this file is only
 * the disk operations around it.
 *
 * Emit new, read old (SPEC §7.11): a v0 `.pin-lock.json` is read when no koine
 * lockfile exists yet, and the next save migrates it — the new file is written,
 * the old one removed. A lockfile is the consumer tool's own state (a
 * relationship, never part of any package), so migrating it in place is the
 * tool's right.
 */
import { join } from "node:path";
import { rm } from "node:fs/promises";
import type { Lockfile } from "./core/types.js";
import { LOCKFILE_PATH, LOCKFILE_PATH_V0 } from "./core/types.js";
import { emptyLock, parseLockfile, serializeLockfile } from "./core/lock.js";
import { pathExists, readJson, writeTextAtomic } from "./fsx.js";

/** Load the consumer's lockfile — koine form first, v0 read-old — or an empty one (U1). */
export async function loadLock(cwd: string): Promise<Lockfile> {
  const file = join(cwd, LOCKFILE_PATH);
  if (await pathExists(file)) return parseLockfile(await readJson<unknown>(file));
  const v0 = join(cwd, LOCKFILE_PATH_V0);
  if (await pathExists(v0)) return parseLockfile(await readJson<unknown>(v0));
  return emptyLock();
}

/**
 * Persist the lockfile atomically, always in the koine form. Returns true when
 * a v0 lockfile was migrated away in the same act (worth one log line).
 */
export async function saveLock(cwd: string, lock: Lockfile): Promise<boolean> {
  await writeTextAtomic(join(cwd, LOCKFILE_PATH), serializeLockfile(lock));
  const v0 = join(cwd, LOCKFILE_PATH_V0);
  if (await pathExists(v0)) {
    await rm(v0);
    return true;
  }
  return false;
}
