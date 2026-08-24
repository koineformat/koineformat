/**
 * `koine add <source> [--as <dir>]` — resolve a source, vendor it into
 * ./knowledge/<name>/, and record it in the lockfile. Zero-config (U1): works in
 * any repo with no init step. Idempotent (U3): re-adding a current package is a
 * no-op, never a rewrite.
 */
import { join } from "node:path";
import { loadLock, saveLock } from "../lockfile.js";
import { lockEntryFor } from "../core/lock.js";
import { resolveSource, type FetchLike } from "../sources.js";
import { pathExists, writePackageAtomic } from "../fsx.js";
import { errAlreadyExists } from "../core/errors.js";
import { defaultDir } from "../vendor.js";

export interface AddOptions {
  cwd: string;
  source: string;
  as?: string;
  fetchImpl?: FetchLike;
}

export interface AddResult {
  name: string;
  dir: string;
  version: string;
  ref?: string;
  fileCount: number;
  alreadyUpToDate: boolean;
  warnings: string[];
}

export async function add(opts: AddOptions): Promise<AddResult> {
  const { pkg, warnings } = await resolveSource(opts.source, { cwd: opts.cwd, fetchImpl: opts.fetchImpl });
  const name = opts.as ?? pkg.manifest.name;
  const dir = defaultDir(name);
  const lock = await loadLock(opts.cwd);

  const newEntry = await lockEntryFor(pkg, dir);
  const existing = lock.packages[name];

  const base = {
    name,
    dir,
    version: pkg.manifest.version,
    ...(pkg.resolved.ref ? { ref: pkg.resolved.ref } : {}),
    fileCount: pkg.files.size - 1,
    warnings,
  };

  // Idempotence (U3): same name, same fingerprint → already up to date, no rewrite.
  if (existing && existing.integrity === newEntry.integrity) {
    return { ...base, alreadyUpToDate: true };
  }

  // Don't clobber an untracked directory that happens to sit at the target.
  if (!existing && (await pathExists(join(opts.cwd, dir)))) {
    throw errAlreadyExists(dir);
  }

  await writePackageAtomic(join(opts.cwd, dir), pkg.files);
  lock.packages[name] = newEntry;
  await saveLock(opts.cwd, lock);
  return { ...base, alreadyUpToDate: false };
}
