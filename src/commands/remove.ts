/**
 * `koine remove <name>` — delete the vendored directory and drop its lockfile row.
 */
import { join } from "node:path";
import { loadLock, saveLock } from "../lockfile.js";
import { removeDir } from "../fsx.js";
import { errNotInstalled } from "../core/errors.js";

export interface RemoveOptions {
  cwd: string;
  name: string;
}

export interface RemoveResult {
  name: string;
  dir: string;
}

export async function remove(opts: RemoveOptions): Promise<RemoveResult> {
  const lock = await loadLock(opts.cwd);
  const entry = lock.packages[opts.name];
  if (!entry) throw errNotInstalled(opts.name);

  await removeDir(join(opts.cwd, entry.dir));
  delete lock.packages[opts.name];
  await saveLock(opts.cwd, lock);
  return { name: opts.name, dir: entry.dir };
}
