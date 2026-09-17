/**
 * The package envelope, in TypeScript. Mirrors SPEC.md §7.3 (manifest) and
 * §7.7 (lockfile), including the read-only v0 dialect of §7.11. The *content*
 * inside a package is free-form and never typed here — only the envelope is.
 *
 * Two dialects, one rule (SPEC §7.11): an emitter writes the koine form
 * (`koine.json` · one root hash in `integrity`); a reader also accepts the v0
 * dialect (`pin.json` · per-file `contents[]`). A package carrying both
 * manifests is refused as ambiguous.
 */

/** A single shipped file with its integrity digest (v0 dialect only). */
export interface ContentEntry {
  /** POSIX path relative to the package root; MUST NOT escape it. */
  path: string;
  /** IANA media type hint; informative. */
  media?: string;
  /** SRI-style "<algo>-<base64(digest)>"; the v0 dialect's spelling. Over raw bytes. */
  integrity: string;
}

/** Where a package authoritatively lives (SPEC §7.3 `source`). */
export interface ManifestSource {
  type: "git" | "path" | "url";
  url?: string;
  /** Commit/tag pinned at publish time; SHOULD be immutable. */
  ref?: string;
  subpath?: string;
}

/**
 * SPEC §7.3 provenance block — who published *this package*. Distinct from the two
 * other things the family spells `provenance`; see SPEC §7.3's field note.
 *
 * `method` is carried through unvalidated (SPEC §7.3), so this union documents
 * the vocabulary rather than gating it. `bip340` names the koine signing
 * chapter's scheme (koine SPEC §7); its binding rules live there, not here.
 */
export interface Provenance {
  published_by?: string;
  published_at?: string;
  method?: "git-commit" | "sigstore" | "minisign" | "bip340" | "none";
  signature?: string | null;
}

/**
 * The manifest: `koine.json` at a package root (SPEC §7.3), or the read-only v0
 * dialect `pin.json` (SPEC §7.11). Exactly one of `koine`/`pin` is present —
 * that field IS the dialect discriminator; use `manifestDialect()` to branch.
 */
export interface Manifest {
  /** Spec version, koine form. This CLI understands "0". */
  koine?: string;
  /** Spec version, v0 dialect (read-only). */
  pin?: string;
  /** Package identity; MUST match ^[a-z0-9][a-z0-9._-]*$ */
  name: string;
  /** Opaque, orderable version label (semantics OPEN, SPEC §7.9). */
  version: string;
  description?: string;
  license?: string;
  /** Which floor faithful consumption requires (SPEC §7.3); optional, unvalidated. */
  readingFloor?: number;
  source?: ManifestSource;
  representations?: string[];
  provenance?: Provenance;
  /**
   * Capability tokens a consumer MUST implement to use this package (SPEC §8.1).
   *
   * The must-understand half of the extension surface. Without it koine's only
   * extension shape was `x-`, which §7.5 makes explicitly ignorable — the right
   * rule for an optional facet and the wrong one for a publication or retraction
   * rule a receiver must honour or refuse.
   */
  requires?: string[];
  /**
   * Where this package's own status is published (SPEC §7.3) — an absolute URL.
   *
   * *"Offline verifiability of an old package does not prove it may still be
   * used today."* A withdrawn or superseded package verifies forever and keeps
   * answering; what the form owes is one DECLARATION of where the answer lives,
   * and what a reader must do when it cannot be reached. The revocation
   * *service* stays outside the format.
   */
  status?: string;
  /** koine form: ONE root hash over the canonical tree listing, "sha256:<hex>" (SPEC §7.4). */
  integrity?: string;
  /** v0 dialect only: every shipped file except pin.json itself. */
  contents?: ContentEntry[];
}

/** What a package's declared status source answers (SPEC §7.3). */
export interface PackageStatusDocument {
  /** Spec version this status document targets. */
  koine: string;
  status: "current" | "superseded" | "withdrawn";
  /** ISO-8601 UTC (`Z`) — since when. */
  since?: string;
  /** For "superseded": the package version that replaces this one. */
  supersededBy?: string;
  /** Free prose for a human reading the verdict. */
  note?: string;
}

/**
 * What a consumer concluded about a package's current standing.
 *
 * `possibly-stale` is the answer for an unreachable status source, and it is the
 * whole reason the shape has three values instead of a boolean: a reader that
 * rendered an unreachable source as `current` would be asserting exactly what it
 * failed to check.
 */
export type PackageStanding = "current" | "superseded" | "withdrawn" | "possibly-stale" | "undeclared";

/** Which envelope dialect a validated manifest speaks. */
export type ManifestDialect = "koine" | "v0";

/** The dialect discriminator — exactly one of the two version fields is set. */
export function manifestDialect(m: Manifest): ManifestDialect {
  return m.koine !== undefined ? "koine" : "v0";
}

/** The resolved origin recorded in the lockfile. */
export interface ResolvedRef {
  type: "git" | "path" | "url";
  url: string;
  /** Commit SHA for git sources — always pinned (U2). */
  ref?: string;
  subpath?: string;
}

/** One installed package's row in the lockfile (SPEC §7.7). */
export interface LockEntry {
  /** The source string the consumer originally asked for. */
  requested: string;
  version: string;
  resolved: ResolvedRef;
  /** Consumer-repo-relative directory, e.g. "knowledge/team-decisions". */
  dir: string;
  /** Digest over the sorted contents manifest — the package fingerprint. */
  integrity: string;
}

/** The lockfile: `knowledge/.koine-lock.json` (SPEC §7.7); `.pin-lock.json` read-old. */
export interface Lockfile {
  koine?: string;
  /** v0 dialect (read-old); normalized away on the next save. */
  pin?: string;
  packages: Record<string, LockEntry>;
}

/** The spec version this CLI implements. */
export const SPEC_VERSION = "0";

/** Conventional vendor root in the consumer repo. */
export const KNOWLEDGE_DIR = "knowledge";

/** Lockfile location, relative to the consumer repo root (SPEC §7.7). */
export const LOCKFILE_PATH = "knowledge/.koine-lock.json";

/** The v0 dialect's lockfile location — read when no koine lockfile exists (SPEC §7.11). */
export const LOCKFILE_PATH_V0 = "knowledge/.pin-lock.json";

/** A resolved package ready to vendor: its files + parsed manifest + origin. */
export interface ResolvedPackage {
  manifest: Manifest;
  /** relpath (from package root) → raw bytes. Excludes nothing; includes pin.json. */
  files: Map<string, Uint8Array>;
  resolved: ResolvedRef;
  /** The original source string. */
  requested: string;
}
