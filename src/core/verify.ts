/**
 * The pure core of `koine verify`: given a package's files in memory, check them
 * against their own envelope and — when a lockfile fingerprint is supplied —
 * against the lock. Never throws on a mismatch; an unreadable package comes back
 * as `status: "error"` carrying the cause, so a caller can report every package
 * instead of dying on the first bad one.
 *
 * Two dialects, one verdict (SPEC §7.11): the koine form verifies the ROOT HASH
 * over the canonical listing (THAT the archive changed) and then the identity
 * map (WHICH file — SPEC §7.4); the v0 dialect verifies per-file `contents[]`.
 * The lock pins the manifest itself: for the koine form a `sha256:<hex>` digest
 * over the exact vendored `koine.json` bytes (SPEC §7.7), for v0 the SRI digest
 * over the sorted `contents[]`.
 *
 * The CLI reads the tree from disk and adds the one status this layer cannot
 * know: "missing".
 */
import type { Manifest } from "./types.js";
import { manifestDialect } from "./types.js";
import { isKoineError } from "./errors.js";
import { contentsDigest, rootHash, sha256HexDigest } from "./integrity.js";
import {
  MANIFEST_NAME,
  checkContents,
  manifestFromFiles,
  type ContentsReport,
} from "./manifest.js";
import { NODES_PATH } from "./seal.js";
import { parseNodesJsonl } from "../sidecars.js";

/** `ok` = faithful · `modified` = drifted · `error` = unreadable. */
export type PackageStatus = "ok" | "modified" | "error";

export interface InspectOptions {
  /** Named in the error when the file map has no manifest. */
  where?: string;
  /** The lockfile's recorded fingerprint, when there is one to compare against. */
  expectedIntegrity?: string;
}

export interface PackageInspection {
  status: PackageStatus;
  /** Present when status is "error" (unreadable manifest, unsafe entry, …). */
  message?: string;
  /** The file-level diff against the package's own listing (when readable). */
  report?: ContentsReport;
  /** koine form only: false when the root hash does not match the tree. */
  rootMatches?: boolean;
  /** Present only when `expectedIntegrity` was supplied. */
  lockMatches?: boolean;
  /** The validated manifest (when readable). */
  manifest?: Manifest;
}

/**
 * Inspect a package's bytes. "ok" means the envelope's integrity holds *and* —
 * if asked — the manifest matches the lock. "modified" means the tree drifted
 * (local edits, U5).
 */
export async function inspectFiles(
  files: Map<string, Uint8Array>,
  opts: InspectOptions = {},
): Promise<PackageInspection> {
  try {
    const manifest = manifestFromFiles(files, opts.where ?? "the package");

    if (manifestDialect(manifest) === "koine") {
      // THAT the archive changed: the root over the canonical listing.
      const rootMatches = (await rootHash(files)) === manifest.integrity;

      // WHICH file: the identity map's rows, when the package carries one.
      const nodesBytes = files.get(NODES_PATH);
      const listing = nodesBytes
        ? parseNodesJsonl(new TextDecoder().decode(nodesBytes)).map((row) => ({
            path: row.path,
            integrity: row.contentHash,
          }))
        : [];
      const raw = await checkContents(files, listing);
      // Sidecars are covered by the root, not listed in the map — a `.koine/*`
      // file is never "unlisted".
      const report: ContentsReport = {
        ...raw,
        unlisted: raw.unlisted.filter((p) => !p.startsWith(".koine/")),
      };
      report.ok = report.missing.length + report.mismatched.length + report.unlisted.length === 0;

      const lockMatches =
        opts.expectedIntegrity === undefined
          ? undefined
          : (await sha256HexDigest(files.get(MANIFEST_NAME)!)) === opts.expectedIntegrity;

      const status: PackageStatus =
        rootMatches && report.ok && lockMatches !== false ? "ok" : "modified";
      return {
        status,
        manifest,
        report,
        rootMatches,
        ...(lockMatches === undefined ? {} : { lockMatches }),
      };
    }

    // The v0 dialect: per-file contents[] + the sorted-contents fingerprint.
    const report = await checkContents(files, manifest.contents ?? []);
    const lockMatches =
      opts.expectedIntegrity === undefined
        ? undefined
        : (await contentsDigest(manifest.contents ?? [])) === opts.expectedIntegrity;

    const status: PackageStatus = report.ok && lockMatches !== false ? "ok" : "modified";
    return { status, manifest, report, ...(lockMatches === undefined ? {} : { lockMatches }) };
  } catch (e) {
    return { status: "error", message: isKoineError(e) ? e.message : String(e) };
  }
}

/** The files an inspection flags as changed (for U5 messaging). */
export function changedFiles(insp: { report?: ContentsReport }): string[] {
  if (!insp.report) return [];
  return [...insp.report.mismatched, ...insp.report.missing, ...insp.report.unlisted];
}
