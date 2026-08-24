/**
 * `koine update [name] [--force]` — re-resolve tracked sources to newer versions
 * and rewrite the files + lock. The U5 invariant lives here: if a vendored
 * package has local edits (its on-disk bytes ≠ the lock), update refuses to
 * clobber them and tells you to use --force. Vendored files live in *your* repo
 * and *will* be edited — the problem npm never had.
 */
import { join } from "node:path";
import { loadLock, saveLock } from "../lockfile.js";
import { lockEntryFor } from "../core/lock.js";
import { resolveSource, type FetchLike } from "../sources.js";
import { writePackageAtomic } from "../fsx.js";
import { errLocalEdits, errNotInstalled } from "../core/errors.js";
import { changedFiles, inspectOnDisk } from "../vendor.js";

export interface UpdateOptions {
  cwd: string;
  name?: string;
  force?: boolean;
  fetchImpl?: FetchLike;
}

export interface UpdateItem {
  name: string;
  updated: boolean;
  from: string;
  to: string;
}

export interface UpdateResult {
  items: UpdateItem[];
}

export async function update(opts: UpdateOptions): Promise<UpdateResult> {
  const lock = await loadLock(opts.cwd);
  if (opts.name && !lock.packages[opts.name]) throw errNotInstalled(opts.name);
  const names = opts.name ? [opts.name] : Object.keys(lock.packages);

  const items: UpdateItem[] = [];
  for (const name of names) {
    const entry = lock.packages[name]!;

    // U5: never overwrite local edits unless forced. A missing dir is not an
    // edit — update will simply restore it.
    if (!opts.force) {
      const insp = await inspectOnDisk(opts.cwd, entry);
      if (insp.status === "modified" || insp.status === "error") {
        const files = changedFiles(insp);
        throw errLocalEdits(name, files.length ? files : [entry.dir]);
      }
    }

    const { pkg } = await resolveSource(entry.requested, { cwd: opts.cwd, fetchImpl: opts.fetchImpl });
    const newEntry = await lockEntryFor(pkg, entry.dir);
    if (newEntry.integrity === entry.integrity) {
      items.push({ name, updated: false, from: entry.version, to: entry.version });
      continue;
    }

    await writePackageAtomic(join(opts.cwd, entry.dir), pkg.files);
    lock.packages[name] = newEntry;
    items.push({ name, updated: true, from: entry.version, to: pkg.manifest.version });
  }

  await saveLock(opts.cwd, lock);
  return { items };
}
