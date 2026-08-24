/**
 * A dependency-free tar reader. This is the security-critical "hard 20%": a
 * hostile archive must never place a byte outside the package root, so the
 * reader is deliberately strict and paranoid. It understands plain USTAR, the
 * GNU long-name extension, and pax extended headers (which `git archive` — and
 * therefore GitHub's codeload endpoint — emits). Symlinks, hardlinks, and
 * special files are surfaced as typed entries so the caller can refuse them.
 *
 * Decompression uses node:zlib. No third-party code runs, here or ever (U4/U8).
 */
import { gunzipSync } from "node:zlib";
import { errBadArchive, errTooLarge } from "./core/errors.js";
import { MAX_FILE_BYTES } from "./core/paths.js";

const BLOCK = 512;

export interface TarEntry {
  /** Path exactly as stored in the archive (still carries the top-level dir). */
  path: string;
  type: "file" | "dir" | "symlink" | "hardlink" | "other";
  size: number;
  /** Raw file bytes (empty for non-file entries). Always a fresh copy. */
  data: Uint8Array;
  linkname?: string;
}

const dec = new TextDecoder("utf-8");

function readString(buf: Uint8Array, off: number, len: number): string {
  let end = off;
  const limit = off + len;
  while (end < limit && buf[end] !== 0) end++;
  return dec.decode(buf.subarray(off, end));
}

/** Octal ASCII field, or GNU base-256 when the high bit of the first byte is set. */
function readNumeric(buf: Uint8Array, off: number, len: number): number {
  const first = buf[off] ?? 0;
  if (first & 0x80) {
    let v = 0;
    for (let i = off; i < off + len; i++) {
      const b = buf[i] ?? 0;
      v = v * 256 + (i === off ? b & 0x7f : b);
    }
    return v;
  }
  let s = "";
  for (let i = off; i < off + len; i++) {
    const c = buf[i] ?? 0;
    if (c === 0 || c === 0x20) {
      if (s) break;
      continue;
    }
    s += String.fromCharCode(c);
  }
  return s ? parseInt(s, 8) : 0;
}

function isZeroBlock(buf: Uint8Array, off: number): boolean {
  for (let i = 0; i < BLOCK; i++) if ((buf[off + i] ?? 0) !== 0) return false;
  return true;
}

/** Verify the header checksum (accepts the unsigned or signed convention). */
function checksumOk(buf: Uint8Array, off: number): boolean {
  const stored = readNumeric(buf, off + 148, 8);
  let unsigned = 0;
  let signed = 0;
  for (let i = 0; i < BLOCK; i++) {
    const b = i >= 148 && i < 156 ? 0x20 : buf[off + i] ?? 0;
    unsigned += b;
    signed += (b << 24) >> 24;
  }
  return stored === unsigned || stored === signed;
}

/** Parse pax extended-header records (byte-correct for UTF-8 paths). */
function parsePax(data: Uint8Array): { path?: string; size?: number } {
  const out: { path?: string; size?: number } = {};
  let i = 0;
  while (i < data.length) {
    let j = i;
    while (j < data.length && data[j] !== 0x20) j++;
    const len = parseInt(dec.decode(data.subarray(i, j)), 10);
    if (!Number.isFinite(len) || len <= 0 || i + len > data.length) break;
    const rec = dec.decode(data.subarray(j + 1, i + len - 1)); // skip space, drop trailing \n
    const eq = rec.indexOf("=");
    if (eq >= 0) {
      const key = rec.slice(0, eq);
      const val = rec.slice(eq + 1);
      if (key === "path") out.path = val;
      else if (key === "size") out.size = parseInt(val, 10);
    }
    i += len;
  }
  return out;
}

/** Parse a raw (uncompressed) tar buffer into entries. */
export function parseTar(buf: Uint8Array): TarEntry[] {
  const entries: TarEntry[] = [];
  let off = 0;
  let longName: string | null = null;
  let paxPath: string | null = null;
  let paxSize: number | null = null;

  while (off + BLOCK <= buf.length) {
    if (isZeroBlock(buf, off)) break; // end-of-archive marker
    if (!checksumOk(buf, off)) throw errBadArchive("header checksum mismatch (corrupt tarball)");

    const rawName = readString(buf, off, 100);
    const prefix = readString(buf, off + 345, 155);
    const typeflag = String.fromCharCode(buf[off + 156] ?? 0);
    const linkname = readString(buf, off + 157, 100);
    let size = readNumeric(buf, off + 124, 12);

    const dataOff = off + BLOCK;
    if (size > MAX_FILE_BYTES) throw errTooLarge(`archive entry claims ${size} bytes`);
    const padded = Math.ceil(size / BLOCK) * BLOCK;
    if (dataOff + size > buf.length) throw errBadArchive("truncated archive (entry runs past end)");

    // GNU long name: the data block holds the name for the *next* header.
    if (typeflag === "L") {
      longName = readString(buf, dataOff, size).replace(/\0+$/, "");
      off = dataOff + padded;
      continue;
    }
    // GNU long link name — we reject links anyway, so just consume it.
    if (typeflag === "K") {
      off = dataOff + padded;
      continue;
    }
    // pax extended (per-file 'x') / global ('g') header.
    if (typeflag === "x" || typeflag === "g") {
      const rec = parsePax(buf.subarray(dataOff, dataOff + size));
      if (typeflag === "x") {
        if (rec.path !== undefined) paxPath = rec.path;
        if (rec.size !== undefined) paxSize = rec.size;
      }
      off = dataOff + padded;
      continue;
    }

    const name = paxPath ?? longName ?? (prefix ? `${prefix}/${rawName}` : rawName);
    if (paxSize !== null) size = paxSize;

    let type: TarEntry["type"];
    if (typeflag === "0" || typeflag === "\0" || typeflag === "7") type = "file";
    else if (typeflag === "5") type = "dir";
    else if (typeflag === "2") type = "symlink";
    else if (typeflag === "1") type = "hardlink";
    else type = "other";

    const data = type === "file" ? buf.slice(dataOff, dataOff + size) : new Uint8Array(0);
    const entry: TarEntry = { path: name, type, size, data };
    if (type === "symlink" || type === "hardlink") entry.linkname = linkname;
    entries.push(entry);

    off = dataOff + padded;
    longName = null;
    paxPath = null;
    paxSize = null;
  }

  return entries;
}

/** gunzip → parse. The entry point for a fetched `.tar.gz`. */
export function extractTarGz(gz: Uint8Array): TarEntry[] {
  let tar: Uint8Array;
  try {
    tar = gunzipSync(gz);
  } catch (e) {
    throw errBadArchive(`gunzip failed (${(e as Error).message})`);
  }
  return parseTar(tar);
}
