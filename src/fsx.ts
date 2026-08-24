/**
 * Filesystem helpers with two non-negotiable properties: writes are **atomic**
 * (a package is never left half-written — U2/U3) and reads **reject unsafe
 * entries** (symlinks and special files never enter a package — U4).
 *
 * This is the CLI's filesystem shell; the envelope core in `core/` never touches
 * a path. `resolveWithin` lives here for the same reason: it needs a real
 * absolute path, which only a filesystem has.
 */
import { mkdir, mkdtemp, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve, sep } from "node:path";
import { errPathTraversal, errUnsafeEntry, errBadManifest } from "./core/errors.js";

let tmpCounter = 0;

/**
 * Belt-and-suspenders: given a package root and a relative path, resolve the
 * absolute destination and prove it stays within the root. Returns the absolute
 * path. Use this at the moment of writing, after assertSafeRelPath.
 */
export function resolveWithin(rootDir: string, relPath: string): string {
  const root = resolve(rootDir);
  const abs = resolve(root, relPath);
  if (abs !== root && !abs.startsWith(root + sep)) throw errPathTraversal(relPath);
  return abs;
}

/** True iff a path exists (file or dir). */
export async function pathExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Write `files` (relpath → bytes) into `destDir` atomically: everything lands in
 * a temp sibling first, then the temp dir is swapped into place. If anything
 * fails, the temp dir is removed and `destDir` is untouched. Each relpath is
 * re-checked against the root at write time (defense in depth).
 */
export async function writePackageAtomic(destDir: string, files: Map<string, Uint8Array>): Promise<void> {
  const parent = dirname(destDir);
  await mkdir(parent, { recursive: true });
  const tmp = await mkdtemp(join(parent, ".koine-tmp-"));
  try {
    for (const [rel, bytes] of files) {
      const abs = resolveWithin(tmp, rel);
      await mkdir(dirname(abs), { recursive: true });
      await writeFile(abs, bytes);
    }
    await rm(destDir, { recursive: true, force: true });
    await rename(tmp, destDir);
  } catch (e) {
    await rm(tmp, { recursive: true, force: true });
    throw e;
  }
}

/**
 * Read an on-disk directory tree into a relpath → bytes map. Rejects symlinks
 * and non-regular files (U4). Directory names use POSIX '/' separators.
 */
export async function readTree(rootDir: string): Promise<Map<string, Uint8Array>> {
  const out = new Map<string, Uint8Array>();
  async function walk(dir: string, prefix: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const ent of entries) {
      const rel = prefix ? `${prefix}/${ent.name}` : ent.name;
      const abs = join(dir, ent.name);
      if (ent.isSymbolicLink()) throw errUnsafeEntry(rel, "symlink");
      if (ent.isDirectory()) await walk(abs, rel);
      else if (ent.isFile()) out.set(rel, await readFile(abs));
      else throw errUnsafeEntry(rel, "special file");
    }
  }
  await walk(rootDir, "");
  return out;
}

/** Parse a JSON file; throws errBadManifest on syntax errors. */
export async function readJson<T>(file: string): Promise<T> {
  const raw = await readFile(file, "utf8");
  try {
    return JSON.parse(raw) as T;
  } catch (e) {
    throw errBadManifest(`${basename(file)} is not valid JSON (${(e as Error).message})`);
  }
}

/**
 * Write text atomically (temp file → rename). Envelope files are serialized by
 * `core/` — this only puts the bytes down.
 */
export async function writeTextAtomic(file: string, text: string): Promise<void> {
  const parent = dirname(file);
  await mkdir(parent, { recursive: true });
  const tmp = join(parent, `.${basename(file)}.tmp-${process.pid}-${tmpCounter++}`);
  await writeFile(tmp, text);
  await rename(tmp, file);
}

/** Remove a directory tree if it exists (no error if absent). */
export async function removeDir(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
}
