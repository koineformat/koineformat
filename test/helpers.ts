/**
 * Test helpers: build sealed packages, write them to disk (for path: sources),
 * synthesize GitHub codeload tarballs + a fake fetch (for github: sources), and
 * craft *malicious* tarballs by hand (for the U4 traversal fixtures).
 */
import { mkdtempSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { gzipSync } from "node:zlib";
import { computeContents } from "../src/core/manifest.js";
import { SPEC_VERSION } from "../src/core/types.js";
import type { FetchLike } from "../src/sources.js";

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

/** A fresh empty temp directory. */
export function tmp(): string {
  return mkdtempSync(join(tmpdir(), "koine-test-"));
}

/**
 * Build a correctly-sealed V0-DIALECT package (content files + a valid pin.json).
 * Deliberately stays on the old dialect: these fixtures are what proves the
 * read-old half of SPEC §7.11 across the suite.
 */
export async function sealedFiles(
  name: string,
  content: Record<string, string>,
  opts: { version?: string } = {},
): Promise<Map<string, Uint8Array>> {
  const files = new Map<string, Uint8Array>();
  for (const [p, c] of Object.entries(content)) files.set(p, enc(c));
  const contents = await computeContents(files); // hashes the content files (skips the manifest)
  const manifest = {
    pin: SPEC_VERSION,
    name,
    version: opts.version ?? "2026.07.0",
    description: "",
    license: "CC-BY-4.0",
    provenance: { published_by: "test", method: "none", signature: null },
    contents,
  };
  files.set("pin.json", enc(JSON.stringify(manifest, null, 2)));
  return files;
}

/** Write a file map into a directory on disk. */
export async function writePackage(dir: string, files: Map<string, Uint8Array>): Promise<string> {
  for (const [rel, bytes] of files) {
    const abs = join(dir, rel);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, bytes);
  }
  return dir;
}

// ── Minimal tar writer (USTAR) ─────────────────────────────────────────────

export interface RawTarEntry {
  name: string;
  data?: Uint8Array;
  /** '0' file, '5' dir, '2' symlink, '1' hardlink. Defaults to '0'. */
  type?: string;
  linkname?: string;
}

function writeStr(block: Uint8Array, off: number, s: string, len: number): void {
  for (let i = 0; i < len; i++) block[off + i] = i < s.length ? s.charCodeAt(i) & 0xff : 0;
}

function header(name: string, size: number, type: string, linkname?: string): Uint8Array {
  const b = new Uint8Array(512);
  writeStr(b, 0, name, 100);
  writeStr(b, 100, "0000644\0", 8);
  writeStr(b, 108, "0000000\0", 8);
  writeStr(b, 116, "0000000\0", 8);
  writeStr(b, 124, size.toString(8).padStart(11, "0") + "\0", 12);
  writeStr(b, 136, "00000000000\0", 12);
  writeStr(b, 148, "        ", 8); // checksum placeholder = 8 spaces
  b[156] = type.charCodeAt(0);
  if (linkname) writeStr(b, 157, linkname, 100);
  writeStr(b, 257, "ustar\0", 6);
  writeStr(b, 263, "00", 2);
  let sum = 0;
  for (let i = 0; i < 512; i++) sum += b[i]!;
  writeStr(b, 148, sum.toString(8).padStart(6, "0") + "\0 ", 8);
  return b;
}

/** Assemble raw entries into an uncompressed tar buffer. */
export function buildTar(entries: RawTarEntry[]): Uint8Array {
  const blocks: Uint8Array[] = [];
  for (const e of entries) {
    const type = e.type ?? "0";
    const data = e.data ?? new Uint8Array(0);
    const isFile = type === "0";
    blocks.push(header(e.name, isFile ? data.length : 0, type, e.linkname));
    if (isFile && data.length > 0) {
      const padded = Math.ceil(data.length / 512) * 512;
      const buf = new Uint8Array(padded);
      buf.set(data);
      blocks.push(buf);
    }
  }
  blocks.push(new Uint8Array(512), new Uint8Array(512)); // end-of-archive
  let total = 0;
  for (const b of blocks) total += b.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const b of blocks) {
    out.set(b, off);
    off += b.length;
  }
  return out;
}

/** gzip a buffer (what codeload serves). */
export function gzip(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(gzipSync(bytes));
}

/** Build a GitHub-style tar.gz: every file under a single `owner-repo-sha/` root. */
export function githubTarGz(files: Map<string, Uint8Array>, root = "koineformat-koineformat-deadbeef"): Uint8Array {
  const entries: RawTarEntry[] = [{ name: `${root}/`, type: "5" }];
  for (const [rel, bytes] of files) entries.push({ name: `${root}/${rel}`, data: bytes });
  return gzip(buildTar(entries));
}

const HEX40 = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0";

/** A fake fetch that serves `tarGz` for codeload and `sha` for the commits API. */
export function fakeGithubFetch(tarGz: Uint8Array, sha: string = HEX40): FetchLike {
  return async (url: string) => {
    if (url.includes("api.github.com")) {
      return { ok: true, status: 200, statusText: "OK", text: async () => sha, arrayBuffer: async () => new ArrayBuffer(0) };
    }
    if (url.includes("codeload.github.com")) {
      const ab = tarGz.buffer.slice(tarGz.byteOffset, tarGz.byteOffset + tarGz.byteLength) as ArrayBuffer;
      return { ok: true, status: 200, statusText: "OK", text: async () => "", arrayBuffer: async () => ab };
    }
    return { ok: false, status: 404, statusText: "Not Found", text: async () => "", arrayBuffer: async () => new ArrayBuffer(0) };
  };
}

/** A fetch that always fails, to simulate being offline. */
export const offlineFetch: FetchLike = async (url: string) => {
  throw new Error(`ENOTFOUND (offline): ${url}`);
};

export const SHA = HEX40;
