/**
 * `koine list` — read the lockfile and print installed packages with their version,
 * source, and on-disk status (ok / modified / missing). Fully offline (U7): it
 * reports *local* staleness, not whether a newer version exists upstream.
 */
import { loadLock } from "../lockfile.js";
import { inspectOnDisk, type OnDiskStatus } from "../vendor.js";

export interface ListOptions {
  cwd: string;
}

export interface ListItem {
  name: string;
  version: string;
  dir: string;
  requested: string;
  ref?: string;
  status: OnDiskStatus;
}

export interface ListResult {
  items: ListItem[];
}

export async function list(opts: ListOptions): Promise<ListResult> {
  const lock = await loadLock(opts.cwd);
  const items: ListItem[] = [];
  for (const [name, entry] of Object.entries(lock.packages)) {
    const insp = await inspectOnDisk(opts.cwd, entry);
    items.push({
      name,
      version: entry.version,
      dir: entry.dir,
      requested: entry.requested,
      ...(entry.resolved.ref ? { ref: entry.resolved.ref } : {}),
      status: insp.status,
    });
  }
  return { items };
}
