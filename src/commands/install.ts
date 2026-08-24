/**
 * `koine install` — restore/repair every package from the lockfile to its *locked*
 * ref, reproducing a byte-identical tree (U2). This is the muscle-memory command
 * (like `npm ci`); it overwrites local edits by design — that is what "restore
 * from lock" means. `koine update` is the one that protects edits (U5).
 */
import { join } from "node:path";
import { loadLock } from "../lockfile.js";
import { lockEntryFor } from "../core/lock.js";
import { resolveLocked, type FetchLike } from "../sources.js";
import { writePackageAtomic } from "../fsx.js";
import { errIntegrityMismatch } from "../core/errors.js";
import { inspectOnDisk } from "../vendor.js";

export interface InstallOptions {
  cwd: string;
  fetchImpl?: FetchLike;
}

export interface InstallItem {
  name: string;
  dir: string;
  restored: boolean;
}

export interface InstallResult {
  items: InstallItem[];
}

export async function install(opts: InstallOptions): Promise<InstallResult> {
  const lock = await loadLock(opts.cwd);
  const items: InstallItem[] = [];

  for (const [name, entry] of Object.entries(lock.packages)) {
    // Already faithful to the lock → nothing to do (offline check).
    if ((await inspectOnDisk(opts.cwd, entry)).status === "ok") {
      items.push({ name, dir: entry.dir, restored: false });
      continue;
    }

    const { pkg } = await resolveLocked(entry, { cwd: opts.cwd, fetchImpl: opts.fetchImpl });
    // The locked ref must still reproduce the locked fingerprint; if not, the
    // source was republished under the same ref — refuse rather than drift (U2).
    if ((await lockEntryFor(pkg, entry.dir)).integrity !== entry.integrity) {
      throw errIntegrityMismatch(name, /* tamper */ true);
    }
    await writePackageAtomic(join(opts.cwd, entry.dir), pkg.files);
    items.push({ name, dir: entry.dir, restored: true });
  }

  return { items };
}
