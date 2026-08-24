/**
 * `koine verify [name]` — re-hash the on-disk files and compare against each
 * package's manifest and the lockfile. Fully offline (U7). Never throws on a
 * mismatch; it reports every package so you see the whole picture, and the CLI
 * shell turns a non-clean result into a non-zero exit.
 */
import { loadLock } from "../lockfile.js";
import { errNotInstalled } from "../core/errors.js";
import { inspectOnDisk, type OnDiskStatus } from "../vendor.js";

export interface VerifyOptions {
  cwd: string;
  name?: string;
}

export interface VerifyItem {
  name: string;
  dir: string;
  version: string;
  status: OnDiskStatus;
  /** Human-readable problems (mismatched/missing/unlisted files, or an error). */
  issues: string[];
}

export interface VerifyResult {
  items: VerifyItem[];
  ok: boolean;
}

export async function verify(opts: VerifyOptions): Promise<VerifyResult> {
  const lock = await loadLock(opts.cwd);
  if (opts.name && !lock.packages[opts.name]) throw errNotInstalled(opts.name);
  const names = opts.name ? [opts.name] : Object.keys(lock.packages);

  const items: VerifyItem[] = [];
  for (const name of names) {
    const entry = lock.packages[name]!;
    const insp = await inspectOnDisk(opts.cwd, entry);
    const issues: string[] = [];

    if (insp.status === "missing") {
      issues.push(`directory ${entry.dir} is missing — run 'koine install' to restore it`);
    } else if (insp.status === "error") {
      issues.push(insp.message ?? "unreadable package");
    } else if (insp.status === "modified") {
      const r = insp.report;
      if (r) {
        for (const p of r.mismatched) issues.push(`modified: ${p}`);
        for (const p of r.missing) issues.push(`missing: ${p}`);
        for (const p of r.unlisted) issues.push(`untracked: ${p}`);
      }
      if (insp.lockMatches === false) issues.push(`manifest fingerprint differs from the lockfile`);
    }

    items.push({ name, dir: entry.dir, version: entry.version, status: insp.status, issues });
  }

  return { items, ok: items.every((i) => i.status === "ok") };
}
