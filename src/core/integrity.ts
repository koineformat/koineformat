/**
 * Integrity (SPEC §4.3 / §8). Every file carries an SRI-style sha256 digest over
 * its raw bytes. v0 supports sha256 only. Deterministic by construction (U2).
 *
 * Hashing goes through WebCrypto (`globalThis.crypto.subtle`), which every host
 * we target has — Node 18+, Bun, Deno, browsers, and Cloudflare Workers — so the
 * envelope core runs unchanged inside a Worker. WebCrypto's digest is async,
 * which is why every hashing function here returns a Promise.
 *
 * Base64 is encoded by hand rather than via `btoa`/Buffer: 20 lines buys the
 * same answer on every runtime, with no host global and no dependency (U8).
 */
import { errNoWebCrypto } from "./errors.js";
import type { ContentEntry } from "./types.js";
import { sha256Hex } from "../sha256.js";

const B64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Standard base64 with padding, over raw bytes. */
function toBase64(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]!;
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    out += B64_ALPHABET[b0 >> 2]!;
    out += B64_ALPHABET[((b0 & 0x03) << 4) | ((b1 ?? 0) >> 4)]!;
    out += b1 === undefined ? "=" : B64_ALPHABET[((b1 & 0x0f) << 2) | ((b2 ?? 0) >> 6)]!;
    out += b2 === undefined ? "=" : B64_ALPHABET[b2 & 0x3f]!;
  }
  return out;
}

/**
 * The slice of WebCrypto this file uses, declared structurally so the core needs
 * no ambient DOM or Node typings — a consumer's tsconfig can be anything.
 */
interface SubtleLike {
  digest(algorithm: string, data: Uint8Array): Promise<ArrayBuffer>;
}

/** The one place WebCrypto is reached for; absent it, fail by name (U6). */
function subtle(): SubtleLike {
  const host = globalThis as unknown as { crypto?: { subtle?: SubtleLike } };
  const s = host.crypto?.subtle;
  if (!s) throw errNoWebCrypto();
  return s;
}

/** `"sha256-<base64(sha256(bytes))>"`. */
export async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await subtle().digest("SHA-256", bytes);
  return `sha256-${toBase64(new Uint8Array(digest))}`;
}

/** Parse an SRI string into `{ algo, value }`; returns null if malformed. */
export function parseIntegrity(integrity: string): { algo: string; value: string } | null {
  const dash = integrity.indexOf("-");
  if (dash <= 0) return null;
  return { algo: integrity.slice(0, dash), value: integrity.slice(dash + 1) };
}

/**
 * `"sha256:<hex>"` — the standard's one digest spelling (SPEC §3.2 · §7.4).
 * Delegates to the codec's canonical hasher so the envelope and the sidecars
 * can never disagree on bytes.
 */
export async function sha256HexDigest(bytes: Uint8Array): Promise<string> {
  return `sha256:${await sha256Hex(bytes)}`;
}

/**
 * True iff `bytes` hash to `integrity`, in EITHER spelling: the standard's
 * `sha256:<hex>` or the v0 dialect's SRI `sha256-<base64>` (SPEC §7.11 —
 * emit new, read old). Unsupported algos return false.
 */
export async function verifyIntegrity(bytes: Uint8Array, integrity: string): Promise<boolean> {
  if (integrity.startsWith("sha256:")) return (await sha256HexDigest(bytes)) === integrity;
  const parsed = parseIntegrity(integrity);
  if (!parsed || parsed.algo !== "sha256") return false;
  return (await sha256(bytes)) === integrity;
}

/**
 * The root hash over the canonical tree listing (SPEC §7.4, normative):
 * every file except `koine.json` itself as a row `<path> <bare-hex>`, rows
 * sorted byte-wise by path, joined with `\n`, terminating `\n` included; the
 * root is the sha256 of those bytes, spelled `"sha256:<hex>"`.
 */
export async function rootHash(files: ReadonlyMap<string, Uint8Array>): Promise<string> {
  const rows = await Promise.all(
    [...files.keys()]
      .filter((path) => path !== "koine.json")
      .sort()
      .map(async (path) => `${path} ${await sha256Hex(files.get(path)!)}`),
  );
  return `sha256:${await sha256Hex(`${rows.join("\n")}\n`)}`;
}

/**
 * The package fingerprint recorded in the lockfile (SPEC §5.2): a sha256 over
 * the *sorted* contents manifest. Independent of file order, so the same set of
 * files always yields the same digest.
 */
export async function contentsDigest(
  contents: ReadonlyArray<Pick<ContentEntry, "path" | "integrity">>,
): Promise<string> {
  const sorted = contents
    .map((c) => ({ path: c.path, integrity: c.integrity }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return sha256(new TextEncoder().encode(JSON.stringify(sorted)));
}
