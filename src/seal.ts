/**
 * Koine codec — the seal (SPEC chapter 6).
 *
 * The chain (§3.3) proves **order and integrity**. It never proves
 * **authorship**: actor strings are claims until signature material backs them.
 * This module is the bytes of chapter 6 — the payload enumeration and its
 * conformance vectors, which the specification declared as gap 2 and said would
 * be *"extracted from the reference implementation's test vectors, not authored
 * ahead of them."*
 *
 * **That extraction was not possible, and finding out why is what unblocked the
 * chapter.** The reference implementation had a live, coherent BIP-340 signing
 * path — and it implemented a DIFFERENT envelope from the one §6.4 declares: it
 * signs `sha256(canonicalJson(subject))` with the method and the public key
 * sitting OUTSIDE the signed bytes. §6.4 asks for DSSE and for both of those
 * facts to be inside the authenticated payload, and it gives the reason: DSSE's
 * `keyid` is an unauthenticated hint that MUST NOT be used for security
 * decisions, and DSSE carries no algorithm field at all. So there was nothing to
 * extract that matched, and every month of waiting for the extraction was a
 * month the chapter could not close.
 *
 * ## Why this file needs no canonicalization, and that is the point
 *
 * DSSE signs the payload as **raw bytes**: the envelope carries them verbatim
 * (base64) and a verifier authenticates exactly those bytes before parsing
 * them. So two implementations agree on what was signed by construction — no
 * JSON canonicalization rule, no sorted-key discipline, no RFC 8785. The
 * delegation certificate is a DSSE envelope too, for the same reason: bytes all
 * the way down.
 *
 * ## Why the curve operation is injected
 *
 * This package has no runtime dependency and that is load-bearing. BIP-340
 * Schnorr is not in WebCrypto, so rather than take a dependency, everything the
 * FORM owns lives here — the pre-authentication encoding, the payload
 * enumeration, the subject binding, the delegation chain — and the ~50 lines of
 * curve math are handed in. That is the same claim §6.5 makes to a reader: *a
 * verifier is ~50 lines in any language.*
 */

import { sha256Bytes } from './sha256.js'
import type { KoineContentHash } from './types.js'

/** The DSSE `payloadType` of a koine seal. */
export const SEAL_PAYLOAD_TYPE = 'application/vnd.koine.seal+json'

/** The DSSE `payloadType` of a delegation certificate. */
export const DELEGATION_PAYLOAD_TYPE = 'application/vnd.koine.delegation+json'

/** The one signing scheme this profile declares (SPEC §6.4). */
export const SEAL_METHOD = 'bip340' as const

/** Where a seal binds — the three grains of §6.3, one model. */
export type KoineSealSubject =
  /** The chain head: one signature vouches the entire history under it. */
  | { readonly grain: 'chain-head'; readonly hash: string }
  /** A single file, via its `contentHash` in the identity map. */
  | { readonly grain: 'file'; readonly nodeId: string; readonly path: string; readonly contentHash: KoineContentHash }
  /** A package, via the root hash its manifest carries. */
  | { readonly grain: 'package'; readonly name: string; readonly version: string; readonly integrity: KoineContentHash }

/** The authenticated payload of a seal. Every field here is INSIDE the signature. */
export interface KoineSealPayload {
  readonly koine: string
  readonly kind: 'koine/seal@v0'
  /**
   * The signing scheme. Inside the payload because DSSE carries no algorithm
   * field, and a scheme a verifier reads from unauthenticated bytes is a scheme
   * an attacker can substitute.
   */
  readonly method: typeof SEAL_METHOD
  /** The author's x-only public key, 64 lowercase hex — inside, for the same reason. */
  readonly pubkey: string
  /** The same key as an `npub1…` (NIP-19), so existing tooling resolves it. */
  readonly npub: string
  /** `actor:(user|agent):<id>` — who claims this. */
  readonly author: string
  /** ISO-8601 UTC (`Z`). */
  readonly signedAt: string
  readonly subject: KoineSealSubject
  /** Present iff the author is an agent — the chain of mandate, in-artifact (§6.7). */
  readonly delegation?: KoineDsseEnvelope
}

/** The authenticated payload of a delegation certificate, signed by the HUMAN's key. */
export interface KoineDelegationPayload {
  readonly koine: string
  readonly kind: 'koine/delegation@v0'
  readonly method: typeof SEAL_METHOD
  /** The agent this certificate speaks for. */
  readonly agent: string
  /** The agent's x-only public key, 64 lowercase hex. */
  readonly agentPubkey: string
  /** The responsible human. */
  readonly by: string
  readonly byPubkey: string
  readonly byNpub: string
  readonly issuedAt: string
}

/** A DSSE 1.0.2 envelope. */
export interface KoineDsseEnvelope {
  readonly payloadType: string
  /** base64 of the payload's exact bytes. */
  readonly payload: string
  readonly signatures: readonly { readonly sig: string; readonly keyid?: string }[]
}

// ---------------------------------------------------------------------------
// base64 — no dependency, no Node builtin, no `btoa`
// ---------------------------------------------------------------------------

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

export function toBase64(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] as number
    const b = i + 1 < bytes.length ? (bytes[i + 1] as number) : undefined
    const c = i + 2 < bytes.length ? (bytes[i + 2] as number) : undefined
    out += B64[a >> 2]
    out += B64[((a & 3) << 4) | ((b ?? 0) >> 4)]
    out += b === undefined ? '=' : B64[((b & 15) << 2) | ((c ?? 0) >> 6)]
    out += c === undefined ? '=' : B64[c & 63]
  }
  return out
}

export function fromBase64(text: string): Uint8Array {
  const clean = text.replace(/=+$/, '')
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4))
  let bits = 0
  let acc = 0
  let at = 0
  for (const char of clean) {
    const value = B64.indexOf(char)
    if (value < 0) throw new Error('seal: payload is not valid base64')
    acc = (acc << 6) | value
    bits += 6
    if (bits >= 8) {
      bits -= 8
      out[at++] = (acc >> bits) & 0xff
    }
  }
  return out.subarray(0, at)
}

// ---------------------------------------------------------------------------
// PAE — DSSE 1.0.2's pre-authentication encoding
// ---------------------------------------------------------------------------

const encoder = new TextEncoder()

/**
 * `PAE(type, body) = "DSSEv1" SP LEN(type) SP type SP LEN(body) SP body`,
 * where LEN is the ASCII-decimal **byte** length and SP is one 0x20.
 *
 * Length-prefixing is what makes the encoding unambiguous: without it a
 * payloadType and a payload could be re-split at a different boundary and
 * produce the same signed bytes.
 */
export function pae(payloadType: string, payload: Uint8Array): Uint8Array {
  const type = encoder.encode(payloadType)
  const prefix = encoder.encode(`DSSEv1 ${type.length} `)
  const middle = encoder.encode(` ${payload.length} `)
  const out = new Uint8Array(prefix.length + type.length + middle.length + payload.length)
  let at = 0
  for (const part of [prefix, type, middle, payload]) {
    out.set(part, at)
    at += part.length
  }
  return out
}

/**
 * The 32-byte message a koine seal signs: `sha256(PAE(payloadType, payload))`.
 *
 * BIP-340 accepts an arbitrary-length message; this profile fixes 32 bytes so
 * that every implementation hashes the same way, and so the primitive is exactly
 * the one a key-delegation certificate already uses.
 */
export async function sealMessage(envelope: KoineDsseEnvelope): Promise<Uint8Array> {
  return sha256Bytes(pae(envelope.payloadType, fromBase64(envelope.payload)))
}

// ---------------------------------------------------------------------------
// Building and reading
// ---------------------------------------------------------------------------

/** The curve operation the host supplies — SPEC §6.5's "~50 lines in any language". */
export type SchnorrVerify = (signature: Uint8Array, message: Uint8Array, pubkey: Uint8Array) => boolean

/** The curve operation for the signing side. */
export type SchnorrSign = (message: Uint8Array, privateKey: Uint8Array) => Uint8Array | Promise<Uint8Array>

const hexToBytes = (hex: string): Uint8Array => {
  if (!/^[0-9a-f]*$/.test(hex) || hex.length % 2 !== 0) throw new Error('seal: not lowercase hex')
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}

/** Wrap a payload object into a DSSE envelope, signing the PAE of its exact bytes. */
export async function sealEnvelope(
  payload: KoineSealPayload | KoineDelegationPayload,
  payloadType: string,
  sign: SchnorrSign,
  privateKey: Uint8Array,
  keyid?: string,
): Promise<KoineDsseEnvelope> {
  const bytes = encoder.encode(JSON.stringify(payload))
  const unsigned: KoineDsseEnvelope = { payloadType, payload: toBase64(bytes), signatures: [] }
  const sig = await sign(await sealMessage(unsigned), privateKey)
  return {
    payloadType,
    payload: unsigned.payload,
    signatures: [{ sig: toBase64(sig), ...(keyid !== undefined ? { keyid } : {}) }],
  }
}

/** Read an envelope's payload back. Does NOT verify — call {@link verifySeal} for that. */
export function readSealPayload<T>(envelope: KoineDsseEnvelope): T {
  return JSON.parse(new TextDecoder().decode(fromBase64(envelope.payload))) as T
}

// ---------------------------------------------------------------------------
// Verification — SPEC §6.5, four steps, offline, no registry
// ---------------------------------------------------------------------------

/** Why a seal did not verify — machine-readable, so a surface can say which step failed. */
export type SealFailure =
  | 'malformed'
  | 'wrong-payload-type'
  | 'wrong-method'
  | 'subject-mismatch'
  | 'bad-signature'
  | 'delegation-key-mismatch'
  | 'delegation-actor-mismatch'
  | 'bad-delegation'

export interface SealVerdict {
  readonly valid: boolean
  readonly reason?: SealFailure
  /** The authenticated payload — present only when `valid`. */
  readonly payload?: KoineSealPayload
}

const sameSubject = (a: KoineSealSubject, b: KoineSealSubject): boolean =>
  JSON.stringify(a) === JSON.stringify(b)

/**
 * Verify a seal, offline, consulting nothing but the shipped bytes and public
 * keys — SPEC §6.5's four steps:
 *
 * 1. recompute the subject from content and compare it against the payload's;
 * 2. decode the author's public key;
 * 3. verify the signature over `sha256(PAE(payloadType, payload))`;
 * 4. for an agent author, verify the delegation certificate (§6.7).
 *
 * `actualSubject` is what the caller recomputed from the artifact — never what
 * the seal claims. A verifier that took the subject from the seal would be
 * checking the seal against itself.
 */
export async function verifySeal(
  envelope: KoineDsseEnvelope,
  actualSubject: KoineSealSubject,
  verify: SchnorrVerify,
): Promise<SealVerdict> {
  if (envelope.payloadType !== SEAL_PAYLOAD_TYPE) return { valid: false, reason: 'wrong-payload-type' }

  let payload: KoineSealPayload
  let pubkey: Uint8Array
  let signature: Uint8Array
  let message: Uint8Array
  try {
    payload = readSealPayload<KoineSealPayload>(envelope)
    const first = envelope.signatures[0]
    if (first === undefined) return { valid: false, reason: 'malformed' }
    pubkey = hexToBytes(payload.pubkey)
    signature = fromBase64(first.sig)
    message = await sealMessage(envelope)
  } catch {
    return { valid: false, reason: 'malformed' }
  }

  if (payload.kind !== 'koine/seal@v0' || payload.method !== SEAL_METHOD) {
    return { valid: false, reason: 'wrong-method' }
  }
  if (!sameSubject(payload.subject, actualSubject)) return { valid: false, reason: 'subject-mismatch' }
  if (!verify(signature, message, pubkey)) return { valid: false, reason: 'bad-signature' }

  if (payload.delegation !== undefined) {
    const chain = await verifyDelegation(payload.delegation, verify)
    if (chain.reason !== undefined) return { valid: false, reason: chain.reason }
    // The certificate must bind THE key that signed THIS seal, and the agent it
    // speaks for must be the author the seal claims. Without both checks a
    // certificate minted for another agent could be pasted onto this envelope.
    if (chain.payload?.agentPubkey !== payload.pubkey) {
      return { valid: false, reason: 'delegation-key-mismatch' }
    }
    if (chain.payload.agent !== payload.author) {
      return { valid: false, reason: 'delegation-actor-mismatch' }
    }
  }

  return { valid: true, payload }
}

/** Verify a delegation certificate under the human key it names. */
export async function verifyDelegation(
  envelope: KoineDsseEnvelope,
  verify: SchnorrVerify,
): Promise<{ reason?: SealFailure; payload?: KoineDelegationPayload }> {
  if (envelope.payloadType !== DELEGATION_PAYLOAD_TYPE) return { reason: 'bad-delegation' }
  try {
    const payload = readSealPayload<KoineDelegationPayload>(envelope)
    const first = envelope.signatures[0]
    if (first === undefined) return { reason: 'bad-delegation' }
    if (payload.kind !== 'koine/delegation@v0' || payload.method !== SEAL_METHOD) {
      return { reason: 'bad-delegation' }
    }
    const ok = verify(fromBase64(first.sig), await sealMessage(envelope), hexToBytes(payload.byPubkey))
    return ok ? { payload } : { reason: 'bad-delegation' }
  } catch {
    return { reason: 'bad-delegation' }
  }
}

/**
 * The subject for a file-grain seal, built from an identity-map row.
 *
 * A helper rather than a convention, because *"the excerpt carries a verifiable
 * claim back to its whole"* (§6.3) only works if both sides build the subject
 * the same way.
 */
export const fileSubject = (nodeId: string, path: string, contentHash: KoineContentHash): KoineSealSubject => ({
  grain: 'file',
  nodeId,
  path,
  contentHash,
})

/** The subject for a tree-grain seal — one signature vouching the whole history under a head. */
export const chainHeadSubject = (hash: string): KoineSealSubject => ({ grain: 'chain-head', hash })

/** The subject for a package-grain seal — the root hash the manifest carries. */
export const packageSubject = (name: string, version: string, integrity: KoineContentHash): KoineSealSubject => ({
  grain: 'package',
  name,
  version,
  integrity,
})
