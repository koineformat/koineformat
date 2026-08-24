/**
 * Path safety (U4 / SPEC §4.3, §10). A vendored package writes files into the
 * consumer's repo, so a hostile package MUST NOT be able to place a byte outside
 * its own directory. This module is the single choke point that proves a
 * package-relative path is safe, plus the size caps that refuse absurd packages.
 *
 * The guarantee is structural: no "..", no absolute paths, no drive letters, no
 * backslashes, no NUL. Symlinks and special files are rejected at read/extract
 * time (see fsx.readTree / tar). There is no code execution, ever.
 *
 * Pure and runtime-agnostic: string + byte checks only. The filesystem-side
 * companion (`resolveWithin`, which needs a real absolute path) lives in fsx.
 */
import { errPathTraversal, errTooLarge } from "./errors.js";

/** Refuse packages larger than this in total (bytes). */
export const MAX_TOTAL_BYTES = 64 * 1024 * 1024; // 64 MiB
/** Refuse any single file larger than this (bytes). */
export const MAX_FILE_BYTES = 32 * 1024 * 1024; // 32 MiB
/** Refuse packages with more than this many files. */
export const MAX_FILES = 10_000;

/**
 * Assert a path (from a manifest or archive) is a safe package-relative POSIX
 * path. Returns the path unchanged on success; throws KoineError otherwise.
 */
export function assertSafeRelPath(p: string): string {
  if (p.length === 0 || p === "." || p === "./") throw errPathTraversal(p);
  if (p.includes("\0")) throw errPathTraversal(p);
  if (p.includes("\\")) throw errPathTraversal(p); // POSIX '/' only in packages
  if (p.startsWith("/")) throw errPathTraversal(p); // absolute
  if (/^[a-zA-Z]:/.test(p)) throw errPathTraversal(p); // Windows drive
  for (const seg of p.split("/")) {
    if (seg === "..") throw errPathTraversal(p);
  }
  return p;
}

/** Enforce the size/count caps over a set of files. */
export function assertWithinCaps(files: Map<string, Uint8Array>): void {
  if (files.size > MAX_FILES) {
    throw errTooLarge(`${files.size} files (max ${MAX_FILES})`);
  }
  let total = 0;
  for (const [path, bytes] of files) {
    if (bytes.byteLength > MAX_FILE_BYTES) {
      throw errTooLarge(`${path} is ${bytes.byteLength} bytes (max ${MAX_FILE_BYTES} per file)`);
    }
    total += bytes.byteLength;
    if (total > MAX_TOTAL_BYTES) {
      throw errTooLarge(`total exceeds ${MAX_TOTAL_BYTES} bytes`);
    }
  }
}
