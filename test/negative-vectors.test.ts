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
    // **Corrected in the fifth round (B15).** This listed `completeness` too —
    // and the read at step 1 had already answered it: `inspection.absent` is
    // computed independently of `status` and rides in `package`. `notRun` says
    // the result carries NO ANSWER; whether an answer may be ACTED ON is what
    // `refusedAt` and the stop rule say. Two facts, two fields.
    expect(verdict.notRun).toEqual(['schema', 'references', 'identity', 'origin'])
  })
})

describe('round 4 — the repairs of the repairs, and one the review did not report', () => {
  it('B13a — an expected subject is compared even when NO seal is offered', async () => {
    // It was compared only inside the seal branch, so a caller that pinned an
    // expectation and offered no seal had it silently ignored. Identity is its
    // own question — WHICH package is this — and needs nobody to have vouched.
    const a = await packageNamed('alpha')
    const b = await packageNamed('beta')
    const manifestB = JSON.parse(new TextDecoder().decode(b.get('koine.json') as Uint8Array)) as Record<string, unknown>
    const subjectB = packageSubject(
      manifestB['name'] as string, manifestB['version'] as string,
      manifestB['integrity'] as KoineContentHash, await manifestPapers(manifestB),
    )
    const verdict = await admitPackage(a, { implements: [], expectedSubject: subjectB })
    expect(verdict.admitted).toBe(false)
    expect(verdict.refusedAt).toBe('identity')
  })

  it('B13b — the comparison is CANONICAL, so key order cannot refuse a correct package', async () => {
    const a = await packageNamed('alpha')
    const { envelope, subject } = await sealOver(a, HUMAN, 'actor:user:acme')
    const reordered = Object.fromEntries(Object.entries(subject).reverse()) as typeof subject
    const verdict = await admitPackage(a, {
      implements: [], expectedSubject: reordered, seal: { envelope, verify },
    })
    expect(verdict.admitted).toBe(true)
    expect(verdict.origin.status).toBe('pass')
  })

  it('B13b’s SIBLING, found by running the shape as a query — a seal’s own subject compares canonically', async () => {
    // Not reported: only a FOREIGN producer can reach it. A second implementation
    // that serialized the subject's keys in another order would have failed to
    // verify against a subject this one derived — an interoperability defect in
    // exactly the path a second implementation proves itself through. The
    // authenticated payload BYTES are untouched; only the comparison changed.
    const a = await packageNamed('alpha')
    const manifest = JSON.parse(new TextDecoder().decode(a.get('koine.json') as Uint8Array)) as Record<string, unknown>
    const derived = packageSubject(
      manifest['name'] as string, manifest['version'] as string,
      manifest['integrity'] as KoineContentHash, await manifestPapers(manifest),
    )
    // A producer that writes the subject's keys in a different order.
    const foreign = Object.fromEntries(Object.entries(derived).reverse()) as typeof derived
    const envelope = await sealEnvelope({
      koine: '0', kind: 'koine/seal@v0', method: 'bip340',
      pubkey: hex(HUMAN_PUB), npub: encodeNpub(HUMAN_PUB), author: 'actor:user:acme',
      signedAt: '2026-09-17T12:00:00Z', subject: foreign,
    } as KoineSealPayload, SEAL_PAYLOAD_TYPE, sign, HUMAN)
    expect((await verifySeal(envelope, derived, verify)).valid).toBe(true)
    // …and a genuinely different subject is still refused.
    expect((await verifySeal(envelope, { ...derived, version: '9.9.9' }, verify)).reason).toBe('subject-mismatch')
  })

  it('B14 — a missing field and a null one are different facts', async () => {
    expect(canonicalJson(undefined)).toBe('null') // as JSON.stringify has it, inside an array
    expect(validateAgainstSchema(null, { const: null })).toEqual([])
    // …and the equality that matters no longer conflates them.
    const { deepEqual } = await import('../src/schema.js')
    expect(deepEqual(undefined, null)).toBe(false)
    expect(deepEqual(null, null)).toBe(true)
    expect(deepEqual(undefined, undefined)).toBe(true)
  })

  it('B15 — every step stops, and the FIRST refusal is the one kept', async () => {
    // The STOP rule was implemented at exactly one of the steps, and the one
    // early return hardcoded `refusedAt: 'capabilities'` — overwriting the
    // earlier refusal it was meant to preserve.
    const files = await packageNamed('alpha', { requires: ['locator'] })
    files.set('alpha.md', enc.encode('# tampered\n')) // integrity fails FIRST
    const verdict = await admitPackage(files, { implements: [] })
    expect(verdict.refusedAt).toBe('integrity')
    expect(verdict.notRun).toEqual(['capabilities', 'schema', 'references', 'identity', 'origin'])
  })

  it('B15 — a refused step never reaches the curve operation', async () => {
    // The reviewer's counting probe: a deliberately-refusing verifier spy was
    // called once after an integrity or schema refusal, and never after a
    // capability one. It must never be called at all.
    let calls = 0
    const spy = (): boolean => {
      calls++
      return false
    }
    const files = await packageNamed('alpha')
    files.set('alpha.md', enc.encode('# tampered\n'))
    const { envelope } = await sealOver(await packageNamed('alpha'), HUMAN, 'actor:user:acme')
    await admitPackage(files, { implements: [], seal: { envelope, verify: spy } })
    expect(calls).toBe(0)
  })
})

describe('the self-audit — found by running the reported shapes as queries, not by a report', () => {
  // The title said "at all three grains" and the form has FOUR actor fields;
  // the fifth review round found the one this query never looked at. Kept as
  // the record of the repair, renamed so it stops asserting the miscount — the
  // whole-population test is `one grammar, every field, BOTH halves` below.
  it('ONE actor grammar — the three grains this query reached', async () => {
    const { isKoineActor } = await import('../src/types.js')
    const { parseCommitsJsonl } = await import('../src/sidecars.js')
    const { validateProposalEnvelope } = await import('../src/proposal.js')

    // It was written three times with three strictnesses: the seal required a
    // non-empty id, the proposal tested the prefix only, and commits.jsonl did
    // not check at all — while §3.3 declares the grammar normative for exactly
    // that field. So `actor:user:` was a valid proposer and an invalid seal
    // author, and `"bob"` was a valid commit actor and invalid everywhere else.
    for (const bad of ['bob', 'actor:user:', 'actor:robot:x', '']) {
      expect([bad, isKoineActor(bad)]).toEqual([bad, false])
      const line = `${JSON.stringify({ seq: 1, actor: bad, what: 'w', why: 'y', when: '2026-01-01T00:00:00Z' })}\n`
      expect(() => parseCommitsJsonl(line)).toThrow()
      expect(validateProposalEnvelope({ proposer: bad }).some(p => p.includes('proposer'))).toBe(true)
    }
    expect(isKoineActor('actor:user:ada')).toBe(true)
    expect(isKoineActor('actor:user:ada', 'agent')).toBe(false)
  })

  it('ONE state law, for both emitters', async () => {
    const { travellingState } = await import('../src/shape.js')
    const declaring = '# x\n\n```shape\nkind: note\nstate: valid\n```\n'
    // The body wins where it declares…
    expect(travellingState(declaring, undefined).state).toBe('valid')
    // …the asserted value answers where the body is silent…
    expect(travellingState('# plain\n', 'draft').state).toBe('draft')
    // …and a contradiction is returned, so each caller owes its own error.
    expect(travellingState(declaring, 'draft').conflict)
      .toEqual({ asserted: 'draft', declared: 'valid' })
  })

  it('the Locator DERIVES the body’s hash by default', async () => {
    const { resolveLocator, resolveLocatorAgainst } = await import('../src/locator.js')
    const body = 'alpha beta gamma\n'
    const wrong = `sha256:${'0'.repeat(64)}` as const

    // The default derives, so a stale pointer is reported as stale.
    expect((await resolveLocator({ contentHash: wrong }, body)).status).toBe('stale')

    // The hot-loop variant still trusts what it is handed — which is exactly why
    // it is named rather than default. Handing it the locator's own hash makes
    // every pointer resolve, always, and nothing says so.
    expect(resolveLocatorAgainst({ contentHash: wrong }, body, wrong).status).toBe('resolved')
  })
})

describe('round 5 — the account of a refusal, and the population of a rule', () => {
  const RECORD = {
    name: 'metric-definition',
    schema: {
      type: 'object',
      properties: { kind: { const: 'metric-definition' }, unit: { enum: ['count', 'rate'] }, denominator: { type: 'string' } },
      required: ['kind'],
      if: { properties: { unit: { const: 'rate' } }, required: ['unit'] },
      then: { required: ['denominator'] },
    },
  }

  /**
   * A correctly-hashed package carrying BOTH errors at once — the reviewer's
   * own construction, and the one a single-phase probe cannot produce. The
   * dangling edge is written as a FOREIGN producer's bytes because this
   * emitter refuses to write one.
   */
  async function bothErrors(): Promise<Map<string, Uint8Array>> {
    const tree = await emitKoineTree({
      nodes: [
        { id: 'n-rate', path: 'rate.md', format: 'markdown', bytes: '# Rate\n\n```shape\nkind: metric-definition\nunit: rate\n```\n' },
        { id: 'n-b', path: 'b.md', format: 'markdown', bytes: 'b\n' },
      ],
      edges: [{ from: 'n-rate', to: 'n-b', type: 'supports' }],
      types: { records: [RECORD] } as never,
    })
    const files = new Map<string, Uint8Array>([...tree].map(([k, v]) => [k, typeof v === 'string' ? enc.encode(v) : v]))
    files.set('.koine/edges.jsonl', enc.encode(`${JSON.stringify({ from: 'n-rate', to: 'n-missing', type: 'supports' })}\n`))
    files.set('koine.json', enc.encode(JSON.stringify({ koine: '0', name: 'both', version: '1.0.0', integrity: `sha256:${'0'.repeat(64)}` })))
    const { manifest } = await sealPackage(files, { now: new Date('2026-09-17T00:00:00Z') })
    files.set('koine.json', enc.encode(serializeManifest(manifest)))
    return files
  }

  it('B15 — a computed verdict is NEVER reported as notRun', async () => {
    const verdict = await admitPackage(await bothErrors(), { implements: [] })
    expect(verdict.admitted).toBe(false)
    expect(verdict.refusedAt).toBe('schema')

    // Both verdicts were computed by one call, so both are answered…
    expect(verdict.tree?.schema.status).toBe('fail')
    expect(verdict.tree?.references.status).toBe('fail')
    expect(verdict.tree?.references.problems.some(p => p.includes('n-missing'))).toBe(true)

    // …and neither may appear in notRun, which says the result has no answer.
    // Only identity and origin are genuinely unanswered: their work never ran.
    expect(verdict.notRun).toEqual(['identity', 'origin'])
  })

  it('B15 — the honesty holds at the other end too: a refusal before the tree leaves both unanswered', async () => {
    const verdict = await admitPackage(await packageNamed('alpha', { requires: ['locator'] }), { implements: [] })
    expect(verdict.refusedAt).toBe('capabilities')
    expect(verdict.tree).toBeUndefined()
    expect(verdict.notRun).toEqual(['schema', 'references', 'identity', 'origin'])
  })

  /**
   * B16 and the two halves the report could not see.
   *
   * The population is the FIELDS §3.3 governs, enumerated from the type
   * definitions — not the call sites anybody remembered. That is the whole
   * lesson: the Q3 repair reached three fields and two of six entry points, and
   * a review found one of the four remaining. Enumerating found the rest.
   */
  it('one grammar, every field, BOTH halves', async () => {
    const { parseEdgesJsonl, parseCommitsJsonl, emitEdgesJsonl, emitCommitsJsonl } = await import('../src/sidecars.js')
    const { validateProposalEnvelope } = await import('../src/proposal.js')
    const commit = (actor: string) => ({ seq: 1, actor, what: 'w', why: 'y', when: '2026-01-01T00:00:00Z' })
    const edge = (actor: string) => ({ from: 'a', to: 'b', type: 'supports', actor })

    for (const bad of ['bob', 'actor:user:', 'actor:robot:x', '']) {
      // readers
      expect(() => parseEdgesJsonl(`${JSON.stringify(edge(bad))}\n`)).toThrow()
      expect(() => parseCommitsJsonl(`${JSON.stringify(commit(bad))}\n`)).toThrow()
      expect(validateProposalEnvelope({ proposer: bad }).some(p => p.includes('proposer'))).toBe(true)
      // writers — the half that decides what OTHER implementations receive
      expect(() => emitEdgesJsonl([edge(bad)])).toThrow()
      expect(() => emitCommitsJsonl([commit(bad)])).toThrow()
      // and through the tree emitter, which is how anyone actually writes one
      await expect(emitKoineTree({
        nodes: [{ id: 'a', path: 'a.md', format: 'markdown', bytes: 'a\n' }],
        commits: [commit(bad)],
      })).rejects.toThrow()
    }

    // The valid value still passes every one of them.
    expect(() => parseEdgesJsonl(`${JSON.stringify(edge('actor:user:test'))}\n`)).not.toThrow()
    expect(() => emitEdgesJsonl([edge('actor:user:test')])).not.toThrow()
    expect(() => emitCommitsJsonl([commit('actor:agent:noe')])).not.toThrow()
    // An edge with NO actor is legal — absence is not malformation (§3.2).
    expect(() => emitEdgesJsonl([{ from: 'a', to: 'b', type: 'supports' }])).not.toThrow()
  })

  it('a tree that does not parse fails INTEGRITY and says which half', async () => {
    const { verifyKoineTree } = await import('../src/tree.js')
    const files = await emitKoineTree({
      nodes: [
        { id: 'a', path: 'a.md', format: 'markdown', bytes: 'a\n' },
        { id: 'b', path: 'b.md', format: 'markdown', bytes: 'b\n' },
      ],
      edges: [{ from: 'a', to: 'b', type: 'supports', actor: 'actor:user:ada' }],
    })
    const foreign = new Map(files)
    foreign.set('.koine/edges.jsonl', (files.get('.koine/edges.jsonl') as string).replace('actor:user:ada', 'bob'))

    const verdict = await verifyKoineTree(foreign)
    expect(verdict.ok).toBe(false)
    expect(verdict.integrity.status).toBe('fail')
    // The bucket is integrity (§3.5: the record parses, hashes recompute, the
    // chain holds) and the TEXT says which half, so a syntax error is never
    // read as byte tampering — two failures, two remedies.
    expect(verdict.integrity.problems[0]).toContain('does not parse')
    expect(verdict.schema.status).toBe('not-established')
    expect(verdict.references.status).toBe('not-established')
    expect(verdict.origin.status).toBe('not-established')
  })
})
