/**
 * Negative vectors — artifacts built to be WRONG, and the verdict each must get.
 *
 * ## Why this file is a category and not a test file
 *
 * Three rounds of outside review produced twelve findings, and the reviewer's
 * method was the same every time: construct an artifact that violates a
 * normative rule and see what the codec says. Every positive test in this
 * package asks *does the good case work*. Almost none asked *does the bad case
 * fail, and fail in the way the specification names*.
 *
 * That asymmetry is not a gap in coverage — it is the difference between a test
 * suite and a **conformance suite**. A second implementation cannot prove itself
 * against our positive fixtures: passing them means it handles what we handle. It
 * can prove itself against these, because each one states the artifact and the
 * required verdict, and a reader that admits any of them is not conformant
 * whatever else it does.
 *
 * ## The shape the twelve findings share, and why these vectors are chosen
 *
 * Six of the twelve were one class: **a verifier trusting a fact it should have
 * derived** — the subject from the caller (B8), the papers from three fields
 * (B3), the path from the proposal (B5), the mandate only where one already was
 * (B2), the actor without checking it is one (B10), the id without its version
 * (B11). Four were another: **two representations of one fact with nothing
 * holding them together** — two emitters of the identity map (B1), two homes for
 * an `$id` (B7), a JavaScript object standing in for a JSON one (B9), a docblock
 * standing in for control flow (B12).
 *
 * So the vectors below are organised by those two classes rather than by finding
 * id, because that is what a second implementer needs to be tested on. The
 * per-finding reproductions live in `review-probes.test.ts` and
 * `composition.test.ts`, in the reporter's own framing.
 */

import { describe, expect, it } from 'bun:test'
import { schnorr } from '@noble/curves/secp256k1.js'

import { emitKoineTree } from '../src/tree.js'
import { sealPackage } from '../src/core/seal.js'
import { serializeManifest } from '../src/core/manifest.js'
import { admitPackage } from '../src/admit.js'
import { canonicalJson, validateAgainstSchema } from '../src/schema.js'
import {
  DELEGATION_PAYLOAD_TYPE,
  SEAL_PAYLOAD_TYPE,
  encodeNpub,
  manifestPapers,
  packageSubject,
  sealEnvelope,
  verifySeal,
  type KoineSealPayload,
} from '../src/seal.js'
import type { KoineContentHash } from '../src/types.js'

const enc = new TextEncoder()
const HEX = '0123456789abcdef'
const hex = (b: Uint8Array): string => [...b].map(x => `${HEX[x >> 4]}${HEX[x & 15]}`).join('')
const sign = (m: Uint8Array, k: Uint8Array): Uint8Array => schnorr.sign(m, k, new Uint8Array(32))
const verify = (s: Uint8Array, m: Uint8Array, p: Uint8Array): boolean => {
  try {
    return schnorr.verify(s, m, p)
  } catch {
    return false
  }
}

const HUMAN = new Uint8Array(32).map((_, i) => (i + 1) % 251 || 7)
const AGENT = new Uint8Array(32).map((_, i) => (i * 7 + 13) % 251 || 11)
const HUMAN_PUB = schnorr.getPublicKey(HUMAN)
const AGENT_PUB = schnorr.getPublicKey(AGENT)

/** A whole, sealed, internally consistent package — the thing each vector then bends. */
async function packageNamed(name: string, extra: Record<string, unknown> = {}): Promise<Map<string, Uint8Array>> {
  const files = new Map<string, Uint8Array>(
    [...(await emitKoineTree({
      nodes: [{ id: `n-${name}`, path: `${name}.md`, format: 'markdown', bytes: `# ${name}\n` }],
    }))].map(([p, v]) => [p, typeof v === 'string' ? enc.encode(v) : v]),
  )
  files.set('koine.json', enc.encode(JSON.stringify({
    koine: '0', name, version: '1.0.0', integrity: `sha256:${'0'.repeat(64)}`, ...extra,
  })))
  const { manifest } = await sealPackage(files, { now: new Date('2026-09-17T00:00:00Z') })
  files.set('koine.json', enc.encode(serializeManifest(manifest)))
  return files
}

const sealOver = async (files: Map<string, Uint8Array>, key: Uint8Array, author: string) => {
  const manifest = JSON.parse(new TextDecoder().decode(files.get('koine.json') as Uint8Array)) as Record<string, unknown>
  const subject = packageSubject(
    manifest['name'] as string, manifest['version'] as string,
    manifest['integrity'] as KoineContentHash, await manifestPapers(manifest),
  )
  const pub = schnorr.getPublicKey(key)
  const envelope = await sealEnvelope({
    koine: '0', kind: 'koine/seal@v0', method: 'bip340',
    pubkey: hex(pub), npub: encodeNpub(pub), author,
    signedAt: '2026-09-17T12:00:00Z', subject,
  } as KoineSealPayload, SEAL_PAYLOAD_TYPE, sign, key)
  return { envelope, subject }
}

describe('class 1 — a verifier must DERIVE what it checks, never be told it', () => {
  it('a genuine seal over package A does not vouch for package B', async () => {
    // B8, and the sharpest vector of the three rounds: both signatures are real,
    // the crypto is sound, and the composition simply never connected the claim
    // to the artifact. `admitPackage` no longer ACCEPTS a subject — it derives
    // one from the manifest it read — so this is now unexpressible as an API
    // misuse and still proven as a vector.
    const a = await packageNamed('alpha')
    const b = await packageNamed('beta')
    const { envelope } = await sealOver(a, HUMAN, 'actor:user:acme')

    const verdict = await admitPackage(b, { implements: [], seal: { envelope, verify } })
    expect(verdict.admitted).toBe(false)
    expect(verdict.refusedAt).toBe('origin')
    expect(verdict.seal?.reason).toBe('subject-mismatch')
  })

  it('…and the same seal DOES vouch for the package it was made over', async () => {
    // The control. A vector that refuses everything proves nothing.
    const a = await packageNamed('alpha')
    const { envelope } = await sealOver(a, HUMAN, 'actor:user:acme')
    const verdict = await admitPackage(a, { implements: [], seal: { envelope, verify } })
    expect(verdict.admitted).toBe(true)
    expect(verdict.origin.status).toBe('pass')
  })

  it('an agent author with no mandate is refused, however good the signature', async () => {
    const a = await packageNamed('alpha')
    const { envelope } = await sealOver(a, AGENT, 'actor:agent:review-test')
    expect((await admitPackage(a, { implements: [], seal: { envelope, verify } })).seal?.reason)
      .toBe('delegation-missing')
  })

  it('a mandate signed by another AGENT is not a mandate', async () => {
    // B10. A chain of mandate with no person at the end of it verified, because
    // the signature was real and nothing asked who had made it.
    const certificate = await sealEnvelope({
      koine: '0', kind: 'koine/delegation@v0', method: 'bip340',
      agent: 'actor:agent:review-test', agentPubkey: hex(AGENT_PUB),
      by: 'actor:agent:not-a-person', byPubkey: hex(HUMAN_PUB), byNpub: encodeNpub(HUMAN_PUB),
      issuedAt: '2026-09-01T00:00:00Z',
    } as never, DELEGATION_PAYLOAD_TYPE, sign, HUMAN)

    const a = await packageNamed('alpha')
    const manifest = JSON.parse(new TextDecoder().decode(a.get('koine.json') as Uint8Array)) as Record<string, unknown>
    const subject = packageSubject(
      manifest['name'] as string, manifest['version'] as string,
      manifest['integrity'] as KoineContentHash, await manifestPapers(manifest),
    )
    const envelope = await sealEnvelope({
      koine: '0', kind: 'koine/seal@v0', method: 'bip340',
      pubkey: hex(AGENT_PUB), npub: encodeNpub(AGENT_PUB), author: 'actor:agent:review-test',
      signedAt: '2026-09-17T12:00:00Z', subject, delegation: certificate,
    } as KoineSealPayload, SEAL_PAYLOAD_TYPE, sign, AGENT)

    expect((await verifySeal(envelope, subject, verify)).reason).toBe('delegation-not-human')
  })

  it('an author that is not an actor at all is refused, not ignored', async () => {
    for (const author of ['nonsense', 'actor:robot:x', 'actor:user:', '']) {
      const a = await packageNamed('alpha')
      const { envelope, subject } = await sealOver(a, HUMAN, author)
      expect([author, (await verifySeal(envelope, subject, verify)).reason])
        .toEqual([author, 'malformed-actor'])
    }
  })

  it('a missing author refuses rather than throwing', async () => {
    // It threw a TypeError before B10 — and an exception is not a verdict.
    const a = await packageNamed('alpha')
    const manifest = JSON.parse(new TextDecoder().decode(a.get('koine.json') as Uint8Array)) as Record<string, unknown>
    const subject = packageSubject(
      manifest['name'] as string, manifest['version'] as string,
      manifest['integrity'] as KoineContentHash, await manifestPapers(manifest),
    )
    const envelope = await sealEnvelope({
      koine: '0', kind: 'koine/seal@v0', method: 'bip340',
      pubkey: hex(HUMAN_PUB), npub: encodeNpub(HUMAN_PUB),
      signedAt: '2026-09-17T12:00:00Z', subject,
    } as never, SEAL_PAYLOAD_TYPE, sign, HUMAN)
    expect((await verifySeal(envelope, subject, verify)).reason).toBe('malformed-actor')
  })
})

describe('class 2 — two representations of one fact, held together mechanically', () => {
  it('a JSON key named __proto__ is DATA, and changing it changes the digest', async () => {
    // B9. `{}`-based canonicalization dropped it, so two manifests that differ
    // produced one digest and a real signature stayed valid across a real change.
    const withA = JSON.parse('{"x-example-metadata":{"__proto__":{"retention":"30d"}},"a":1}') as Record<string, unknown>
    const withB = JSON.parse('{"x-example-metadata":{"__proto__":{"retention":"forever"}},"a":1}') as Record<string, unknown>
    expect(await manifestPapers(withA)).not.toBe(await manifestPapers(withB))
    expect(canonicalJson(withA)).toContain('__proto__')
  })

  it('an object carrying only __proto__ is not equal to the empty object', async () => {
    const carrying = JSON.parse('{"__proto__":{"x":1}}') as Record<string, unknown>
    expect(validateAgainstSchema(carrying, { const: {} })).not.toEqual([])
    // …and still equals itself, so the fix did not simply break equality.
    expect(validateAgainstSchema(carrying, { const: JSON.parse('{"__proto__":{"x":1}}') })).toEqual([])
  })

  it('the signature field is outside its own digest, and every other paper is inside', async () => {
    const base = { koine: '0', name: 'p', version: '1', license: 'CC-BY-4.0', integrity: 'sha256:0' }
    const signed = { ...base, provenance: { method: 'bip340', signature: 'DEADBEEF' } }
    const unsigned = { ...base, provenance: { method: 'bip340', signature: null } }
    expect(await manifestPapers(signed)).toBe(await manifestPapers(unsigned))
    expect(await manifestPapers({ ...base, license: 'proprietary' })).not.toBe(await manifestPapers(base))
  })

  it('a malformed sidecar is a verdict, not an exception', async () => {
    // B12. A caller asking "may I admit this" got a thrown KoineParseError —
    // which has no step, no reasons, and a different meaning at every catch site.
    const files = await packageNamed('alpha')
    files.set('.koine/edges.jsonl', enc.encode('{ this is not jsonl\n'))
    const verdict = await admitPackage(files, { implements: [] })
    expect(verdict.admitted).toBe(false)
    expect(verdict.refusedAt).toBe('envelope')
    expect(verdict.reasons.join(' ')).toContain('does not parse')
  })

  it('a refusal names what it did NOT check, so no pass is inferred from an absence', async () => {
    const files = await packageNamed('alpha', { requires: ['locator'] })
    const verdict = await admitPackage(files, { implements: [] })
    expect(verdict.notRun).toEqual(['schema', 'references', 'completeness', 'origin'])
  })
})
