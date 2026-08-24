/**
 * The one hash the koine form uses — SHA-256, hex, lowercase.
 *
 * Zero dependencies and no host builtin beyond WebCrypto
 * (`globalThis.crypto.subtle`), which every runtime this package targets has:
 * Node 18+, Bun, Deno, browsers and Cloudflare Workers. WebCrypto's digest is
 * async, which is why every hashing path in this codec returns a Promise.
 *
 * The algorithm is normative, not an implementation choice: SPEC §3.2 fixes
 * `contentHash` as `sha256:` + 64 lowercase hex chars, and SPEC §3.3 fixes the
 * chain on the same primitive. A second implementation that produces different
 * bytes here is not a different style — it is a different format.
 */

const HEX = '0123456789abcdef'

/** Lowercase hex over raw bytes. */
function bytesToHex(bytes: Uint8Array): string {
  let out = ''
  for (const byte of bytes) {
    out += HEX[byte >> 4]
    out += HEX[byte & 0x0f]
  }
  return out
}

/** SHA-256 of data, returned as raw bytes. */
export async function sha256Bytes(data: Uint8Array | string): Promise<Uint8Array> {
  const input = typeof data === 'string' ? new TextEncoder().encode(data) : data
  // Copy into a standalone ArrayBuffer: a Uint8Array handed in by a caller may
  // be a view onto a larger buffer, and the copy makes the hashed extent the
  // view's own extent under every runtime's BufferSource handling.
  const buffer = new ArrayBuffer(input.byteLength)
  new Uint8Array(buffer).set(input)
  return new Uint8Array(await crypto.subtle.digest('SHA-256', buffer))
}

/** SHA-256 of data, returned as a lowercase hex string. */
export async function sha256Hex(data: Uint8Array | string): Promise<string> {
  return bytesToHex(await sha256Bytes(data))
}
