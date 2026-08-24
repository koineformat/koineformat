/**
 * The lockfile (SPEC §5.2): `knowledge/.pin-lock.json`, committed to the
 * consumer repo. It is the source of truth for what is installed — the on-disk
 * directory name may differ from the package name, so we always go through here.
 *
 * This module is the lockfile's *shape*: build a row, normalize a parsed one,
 * render it back to bytes. Reading and writing the file is the CLI's job.
 */
import type { LockEntry, Lockfile, ResolvedPackage } from "./types.js";
import { manifestDialect, SPEC_VERSION } from "./types.js";
import { errBadLockfile } from "./errors.js";
import { contentsDigest, sha256HexDigest } from "./integrity.js";
import { MANIFEST_NAME } from "./manifest.js";

/** An empty, well-formed lockfile. */
export function emptyLock(): Lockfile {
  return { koine: SPEC_VERSION, packages: {} };
}

/**
 * Normalize an already-parsed lockfile value — the koine form or the v0 dialect
 * (`pin` field, read-old; SPEC §7.11). A lockfile missing `packages` or its
 * version field is tolerated (older or hand-trimmed files); one that is not an
 * object at all is refused by name rather than treated as empty — "no packages
 * installed" and "your lockfile is garbage" must never look the same (U6).
 */
export function parseLockfile(value: unknown): Lockfile {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw errBadLockfile("top level is not a JSON object");
  }
  const lock = value as Lockfile;
  if (!lock.packages) lock.packages = {};
  if (!lock.koine && !lock.pin) lock.koine = SPEC_VERSION;
  return lock;
}

/** The on-the-wire bytes of a lockfile: pretty JSON, koine form, trailing newline. */
export function serializeLockfile(lock: Lockfile): string {
  const { pin: _pin, koine: _koine, packages, ...rest } = lock;
  return JSON.stringify({ koine: SPEC_VERSION, ...rest, packages }, null, 2) + "\n";
}

/**
 * Build the lockfile row for a resolved package vendored into `dir`. The
 * fingerprint pins the MANIFEST: for the koine form a `sha256:<hex>` digest over
 * the exact `koine.json` bytes (SPEC §7.7 — lockfile → manifest → root hash →
 * identity map); for a v0 package the SRI digest over its sorted `contents[]`.
 */
export async function lockEntryFor(pkg: ResolvedPackage, dir: string): Promise<LockEntry> {
  const integrity =
    manifestDialect(pkg.manifest) === "koine"
      ? await sha256HexDigest(pkg.files.get(MANIFEST_NAME)!)
      : await contentsDigest(pkg.manifest.contents ?? []);
  return {
    requested: pkg.requested,
    version: pkg.manifest.version,
    resolved: pkg.resolved,
    dir,
    integrity,
  };
}
