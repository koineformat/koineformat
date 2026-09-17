/**
 * The crossing — release 3's receipts: chapter 6, the seal.
 *
 * Declared gap 2 said the payload enumeration and its conformance vectors would
 * be *"extracted from the reference implementation's test vectors, not authored
 * ahead of them."* They could not be: the reference implementation had a live
 * BIP-340 path that signed a different envelope from the one §6.4 declares —
 * `sha256(canonicalJson(subject))`, with method and public key OUTSIDE the
 * signed bytes. So the chapter was waiting on an extraction that could never
 * arrive, and the roads that end at it kept waiting too.
 *
 * `@noble/curves` is a **devDependency**: the shipped package stays
 * dependency-free, and the curve operation is injected — which is the same
 * claim §6.5 makes to a reader, that a verifier is ~50 lines in any language.
 */

import { describe, expect, it } from 'bun:test'
import { schnorr } from '@noble/curves/secp256k1.js'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import {
  DELEGATION_PAYLOAD_TYPE,
  SEAL_PAYLOAD_TYPE,
  chainHeadSubject,
  fromBase64,
  pae,
  readSealPayload,
  sealEnvelope,
  sealMessage,
  toBase64,
  verifySeal,
  type KoineDsseEnvelope,
  type KoineSealPayload,
  type KoineSealSubject,
} from '../src/seal.js'

const verify = (sig: Uint8Array, msg: Uint8Array, pub: Uint8Array): boolean => {
  try {
    return schnorr.verify(sig, msg, pub)
  } catch {
    return false
  }
}
const sign = (m: Uint8Array, k: Uint8Array): Uint8Array => schnorr.sign(m, k, new Uint8Array(32))

const HEX = '0123456789abcdef'
const hex = (b: Uint8Array): string => [...b].map((x) => `${HEX[x >> 4]}${HEX[x & 15]}`).join('')

const KEY = new Uint8Array(32).map((_, i) => (i + 1) % 251 || 7)
const PUB = schnorr.getPublicKey(KEY)

const payload = (over: Partial<KoineSealPayload> = {}): KoineSealPayload => ({
  koine: '0',
  kind: 'koine/seal@v0',
  method: 'bip340',
  pubkey: hex(PUB),
  npub: `npub1${hex(PUB).slice(0, 16)}`,
  author: 'actor:user:owner',
  signedAt: '2026-09-17T12:00:00Z',
  subject: chainHeadSubject('a'.repeat(64)),
  ...over,
})

describe('the conformance vectors — the declared-gap half that makes this a standard', () => {
  it('reproduces every recorded verdict', async () => {
    const vectors = JSON.parse(
      await readFile(fileURLToPath(new URL('./vectors/seal-v0.json', import.meta.url)), 'utf8'),
    ) as {
      cases: { name: string; envelope: KoineDsseEnvelope; subject: KoineSealSubject; expect: Record<string, unknown> }[]
    }
    expect(vectors.cases.length).toBeGreaterThan(0)
    for (const testCase of vectors.cases) {
      const verdict = await verifySeal(testCase.envelope, testCase.subject, verify)
      expect([testCase.name, verdict.valid]).toEqual([testCase.name, testCase.expect['valid']])
      if (testCase.expect['reason'] !== undefined) {
        expect([testCase.name, verdict.reason]).toEqual([testCase.name, testCase.expect['reason']])
      }
    }
  })

  it('is not vacuous — a flipped byte in any vector breaks it', async () => {
    const vectors = JSON.parse(
      await readFile(fileURLToPath(new URL('./vectors/seal-v0.json', import.meta.url)), 'utf8'),
    ) as { cases: { envelope: KoineDsseEnvelope; subject: KoineSealSubject; expect: { valid: boolean } }[] }
    const valid = vectors.cases.find((c) => c.expect.valid)
    expect(valid).toBeDefined()
    const bytes = fromBase64((valid as NonNullable<typeof valid>).envelope.payload)
    bytes[bytes.length - 2] = (bytes[bytes.length - 2] as number) ^ 0x01
    const tampered = { ...(valid as NonNullable<typeof valid>).envelope, payload: toBase64(bytes) }
    expect((await verifySeal(tampered, (valid as NonNullable<typeof valid>).subject, verify)).valid).toBe(false)
  })
})

describe('§6.4 — the envelope is DSSE, and method and key are INSIDE the signature', () => {
  it('encodes PAE exactly as DSSE 1.0.2 specifies', () => {
    // "DSSEv1" SP LEN(type) SP type SP LEN(body) SP body — length-prefixed, so
    // the same bytes cannot be re-split at a different boundary.
    expect(new TextDecoder().decode(pae('ab', new TextEncoder().encode('xyz')))).toBe('DSSEv1 2 ab 3 xyz')
  })

  it('refuses a seal whose METHOD was swapped — the substitution DSSE cannot prevent alone', async () => {
    const envelope = await sealEnvelope(payload(), SEAL_PAYLOAD_TYPE, sign, KEY)
    const inner = JSON.parse(new TextDecoder().decode(fromBase64(envelope.payload)))
    inner.method = 'something-weaker'
    const swapped = { ...envelope, payload: toBase64(new TextEncoder().encode(JSON.stringify(inner))) }
    expect((await verifySeal(swapped, payload().subject, verify)).valid).toBe(false)
    // …and the reason it is refused is not the `method` check in front of it:
    // the method is INSIDE the authenticated bytes, so swapping it moves the
    // signed message, which is what makes algorithm substitution unavailable
    // rather than merely detected. DSSE alone cannot do this — its `keyid` is an
    // unauthenticated hint and it carries no algorithm field at all.
    expect(hex(await sealMessage(swapped))).not.toBe(hex(await sealMessage(envelope)))
    const sig = fromBase64(envelope.signatures[0]!.sig)
    expect(verify(sig, await sealMessage(swapped), PUB)).toBe(false)
  })

  it('refuses a seal whose KEY was swapped for the attacker’s', async () => {
    const attacker = new Uint8Array(32).map((_, i) => (i * 3 + 5) % 251 || 9)
    const envelope = await sealEnvelope(payload(), SEAL_PAYLOAD_TYPE, sign, KEY)
    const inner = JSON.parse(new TextDecoder().decode(fromBase64(envelope.payload)))
    inner.pubkey = hex(schnorr.getPublicKey(attacker))
    const swapped = { ...envelope, payload: toBase64(new TextEncoder().encode(JSON.stringify(inner))) }
    expect((await verifySeal(swapped, payload().subject, verify)).reason).toBe('bad-signature')
  })

  it('needs no canonicalization rule — the payload is authenticated as raw bytes', async () => {
    // Two payloads with the same content and different key ORDER are different
    // artifacts, each internally consistent. That is DSSE working: no sorted-key
    // discipline, no RFC 8785, and two implementations agree by construction.
    const a = await sealEnvelope(payload(), SEAL_PAYLOAD_TYPE, sign, KEY)
    const reordered = JSON.parse(new TextDecoder().decode(fromBase64(a.payload))) as Record<string, unknown>
    const b = await sealEnvelope(
      Object.fromEntries(Object.entries(reordered).reverse()) as unknown as KoineSealPayload,
      SEAL_PAYLOAD_TYPE,
      sign,
      KEY,
    )
    expect(a.payload).not.toBe(b.payload)
    expect((await verifySeal(a, payload().subject, verify)).valid).toBe(true)
    expect((await verifySeal(b, payload().subject, verify)).valid).toBe(true)
  })
})

describe('§6.5 — verification is offline, and checks the subject it RECOMPUTED', () => {
  it('refuses a seal presented against a subject the artifact does not have', async () => {
    const envelope = await sealEnvelope(payload(), SEAL_PAYLOAD_TYPE, sign, KEY)
    const verdict = await verifySeal(envelope, chainHeadSubject('f'.repeat(64)), verify)
    expect(verdict).toEqual({ valid: false, reason: 'subject-mismatch' })
  })

  it('returns the authenticated payload only on a pass', async () => {
    const envelope = await sealEnvelope(payload(), SEAL_PAYLOAD_TYPE, sign, KEY)
    expect((await verifySeal(envelope, payload().subject, verify)).payload?.author).toBe('actor:user:owner')
    expect((await verifySeal(envelope, chainHeadSubject('0'.repeat(64)), verify)).payload).toBeUndefined()
  })

  it('refuses an envelope with the wrong payloadType before reading a byte of it', async () => {
    const envelope = await sealEnvelope(payload(), SEAL_PAYLOAD_TYPE, sign, KEY)
    expect((await verifySeal({ ...envelope, payloadType: 'application/json' }, payload().subject, verify)).reason)
      .toBe('wrong-payload-type')
  })
})

describe('§6.7 — the delegation certificate binds THIS key and THIS agent', () => {
  const AGENT = new Uint8Array(32).map((_, i) => (i * 7 + 13) % 251 || 11)
  const AGENT_PUB = schnorr.getPublicKey(AGENT)

  const certificate = async (over: Record<string, unknown> = {}) =>
    sealEnvelope(
      {
        koine: '0',
        kind: 'koine/delegation@v0',
        method: 'bip340',
        agent: 'actor:agent:noe',
        agentPubkey: hex(AGENT_PUB),
        by: 'actor:user:owner',
        byPubkey: hex(PUB),
        byNpub: `npub1${hex(PUB).slice(0, 16)}`,
        issuedAt: '2026-09-01T00:00:00Z',
        ...over,
      } as never,
      DELEGATION_PAYLOAD_TYPE,
      sign,
      KEY,
    )

  it('verifies an agent-authored seal through the human who vouched for its key', async () => {
    const envelope = await sealEnvelope(
      payload({ pubkey: hex(AGENT_PUB), author: 'actor:agent:noe', delegation: await certificate() }),
      SEAL_PAYLOAD_TYPE,
      sign,
      AGENT,
    )
    expect((await verifySeal(envelope, payload().subject, verify)).valid).toBe(true)
  })

  it('refuses a certificate minted for ANOTHER key, pasted onto this envelope', async () => {
    const other = new Uint8Array(32).map((_, i) => (i * 11 + 3) % 251 || 17)
    const envelope = await sealEnvelope(
      payload({
        pubkey: hex(AGENT_PUB),
        author: 'actor:agent:noe',
        delegation: await certificate({ agentPubkey: hex(schnorr.getPublicKey(other)) }),
      }),
      SEAL_PAYLOAD_TYPE,
      sign,
      AGENT,
    )
    expect((await verifySeal(envelope, payload().subject, verify)).reason).toBe('delegation-key-mismatch')
  })

  it('refuses a certificate that speaks for a different agent than the seal claims', async () => {
    const envelope = await sealEnvelope(
      payload({
        pubkey: hex(AGENT_PUB),
        author: 'actor:agent:someone-else',
        delegation: await certificate(),
      }),
      SEAL_PAYLOAD_TYPE,
      sign,
      AGENT,
    )
    expect((await verifySeal(envelope, payload().subject, verify)).reason).toBe('delegation-actor-mismatch')
  })

  it('refuses a certificate the named human did not sign', async () => {
    const impostor = new Uint8Array(32).map((_, i) => (i * 5 + 2) % 251 || 23)
    const forged = await sealEnvelope(
      readSealPayload(await certificate()),
      DELEGATION_PAYLOAD_TYPE,
      sign,
      impostor,
    )
    const envelope = await sealEnvelope(
      payload({ pubkey: hex(AGENT_PUB), author: 'actor:agent:noe', delegation: forged }),
      SEAL_PAYLOAD_TYPE,
      sign,
      AGENT,
    )
    expect((await verifySeal(envelope, payload().subject, verify)).reason).toBe('bad-delegation')
  })

  it('keeps verifying after revocation — authorization is erased, authorship never is', async () => {
    // §6.9: verification is stateless. Nothing here can be told that a key was
    // revoked, and that is the design: a revoked agent's past work stays
    // attributable, and "is this key revoked today" is the way-home's question.
    const envelope = await sealEnvelope(
      payload({ pubkey: hex(AGENT_PUB), author: 'actor:agent:noe', delegation: await certificate() }),
      SEAL_PAYLOAD_TYPE,
      sign,
      AGENT,
    )
    expect((await verifySeal(envelope, payload().subject, verify)).valid).toBe(true)
  })
})

describe('base64 and the message, without a dependency or a Node builtin', () => {
  it('round-trips every byte value', () => {
    for (const length of [0, 1, 2, 3, 32, 64, 255]) {
      const bytes = new Uint8Array(length).map((_, i) => (i * 37) % 256)
      expect([...fromBase64(toBase64(bytes))]).toEqual([...bytes])
    }
  })

  it('signs a 32-byte message, so the primitive is the delegation certificate’s', async () => {
    const envelope = await sealEnvelope(payload(), SEAL_PAYLOAD_TYPE, sign, KEY)
    expect((await sealMessage(envelope)).length).toBe(32)
  })
})
