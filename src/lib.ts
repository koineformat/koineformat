/**
 * `koineformat` — the library surface.
 *
 * This entry exports the package *envelope* and nothing else: the manifest, the
 * integrity digests, seal, verify, and the lockfile shape. It is the same code
 * the `koine` CLI runs — the envelope exists exactly once, here — with the CLI's
 * filesystem, network, and terminal layers left behind.
 *
 * Everything below is **runtime-agnostic**: no Node builtin and no dependency is
 * reachable from this file, so it imports unchanged into a Cloudflare Worker,
 * Deno, a browser, Bun, or Node 18+. That is enforced mechanically — see the
 * "worker-safe by construction" block in `test/lib.test.ts`, which walks this
 * entry's real import graph. The only host capability it needs is WebCrypto
 * (`globalThis.crypto.subtle`), which is why every hashing function is async.
 *
 * Working in bytes, not paths: you hand in `Map<relativePath, Uint8Array>`, the
 * same shape the CLI builds by walking a directory.
 *
 *   import { sealPackage, inspectFiles, serializeManifest } from "koineformat/lib"
 *
 *   const files = new Map([["notes.md", new TextEncoder().encode("…")], ["koine.json", …]])
 *   const { manifest } = await sealPackage(files)
 *   const bytes = serializeManifest(manifest)
 *
 * The CLI (`koine add`/`install`/`update`) is deliberately absent: vendoring means
 * writing into a repo, which is a filesystem act.
 */

// ── The envelope's types (SPEC §7.3, §7.7, §7.11) ──────────────────────────
export type {
  ContentEntry,
  LockEntry,
  Lockfile,
  Manifest,
  ManifestSource,
  Provenance,
  ResolvedPackage,
  ResolvedRef,
} from "./core/types.js";
export type { ManifestDialect } from "./core/types.js";
export {
  KNOWLEDGE_DIR,
  LOCKFILE_PATH,
  LOCKFILE_PATH_V0,
  SPEC_VERSION,
  manifestDialect,
} from "./core/types.js";

// ── Errors: every failure names its cause and its fix (U6) ─────────────────
export {
  KoineError,
  isKoineError,
  errAlreadyExists,
  errBadArchive,
  errBadLockfile,
  errBadManifest,
  errIntegrityMismatch,
  errLocalEdits,
  errMissingManifest,
  errNetwork,
  errNoWebCrypto,
  errNotInstalled,
  errPathTraversal,
  errRefNotFound,
  errTooLarge,
  errUnknownSource,
  errUnlistedFile,
  errUnsafeEntry,
  errUnsupportedSpec,
} from "./core/errors.js";

// ── Manifest: validate, parse, serialize, diff ─────────────────────────────
export {
  MANIFEST_NAME,
  MANIFEST_NAME_V0,
  NAME_RE,
  checkContents,
  computeContents,
  guessMedia,
  manifestFromFiles,
  parseManifest,
  serializeManifest,
  validateManifest,
} from "./core/manifest.js";
export type { ContentsReport } from "./core/manifest.js";

// ── Integrity: digests over raw bytes (async — WebCrypto) ──────────────────
export {
  contentsDigest,
  parseIntegrity,
  rootHash,
  sha256,
  sha256HexDigest,
  verifyIntegrity,
} from "./core/integrity.js";

// ── Seal + verify, over in-memory bytes ────────────────────────────────────
export { NODES_PATH, formatOf, sealPackage } from "./core/seal.js";
export type { SealPackageOptions, SealedPackage } from "./core/seal.js";
export { changedFiles, inspectFiles } from "./core/verify.js";
export type { InspectOptions, PackageInspection, PackageStatus } from "./core/verify.js";

// ── Lockfile: build a row, normalize, render ───────────────────────────────
export { emptyLock, lockEntryFor, parseLockfile, serializeLockfile } from "./core/lock.js";

// ── Path safety + size caps (U4) ───────────────────────────────────────────
export { MAX_FILES, MAX_FILE_BYTES, MAX_TOTAL_BYTES, assertSafeRelPath, assertWithinCaps } from "./core/paths.js";
