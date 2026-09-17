/**
 * The composition tests — the whole path, and the counter-probes an outside
 * reviewer asked for by name.
 *
 * The 2026-09-17 DW-Atlas review of 0.6.0 reported six defects against a package
 * whose own 212 tests were green, and every one of them lived **between** the
 * pieces: *"Die verbleibenden Probleme liegen besonders in der
 * Zusammensetzung."* That is the same finding the first review made about the
 * tree codec, arriving one layer up, and it is the reason this file exists
 * separately from the suites that prove each piece.
 *
 * The rule this file encodes: **a law with two enforcers is a law with a hole in
 * it.** `emitKoineTree` and `sealPackage` are both emitters of the identity map;
 * the travel law held at the first and not at the second, so a package that
 * passed the gate could be sealed and re-exported with the refused bodies back
 * in. Nothing short of running the whole path finds that.
 *
 * Every test here names the reviewer's finding id, so a future reader can trace
 * the test to the report that earned it.
 *
 * Covers SPEC §7.4 (sealing preserves the identity map's meaning, and a declared
 * absence is not drift), §7.15 (the reference import flow), §6.3 (the package
 * subject binds the papers) and §6.7 (an agent author's mandate is required).
 */

import { describe, expect, it } from 'bun:test'
import { schnorr } from '@noble/curves/secp256k1.js'

import { emitKoineTree, parseKoineTree } from '../src/tree.js'
import { sealPackage } from '../src/core/seal.js'
import { inspectFiles } from '../src/core/verify.js'
import { admitPackage } from '../src/admit.js'
import { serializeManifest } from '../src/core/manifest.js'
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
import { sha256Hex } from '../src/sha256.js'
import type { KoineContentHash } from '../src/types.js'

const enc = new TextEncoder()
const hash = async (b: string): Promise<KoineContentHash> => `sha256:${await sha256Hex(b)}`
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

const body = (state?: string): string =>
  state === undefined
    ? '# A body\n\nplain prose, no shape block.\n'
    : `# A body\n\n\`\`\`shape\nkind: note\nstate: ${state}\n\`\`\`\n`

/** The reviewer's fixture: five bodies, one per position plus one undeclared. */
const FIVE = [
  { id: 'n-undeclared', path: 'a-undeclared.md', format: 'markdown', bytes: body() },
  { id: 'n-spoken', path: 'b-spoken.md', format: 'markdown', bytes: body('spoken') },
  { id: 'n-draft', path: 'c-draft.md', format: 'markdown', bytes: body('draft') },
  { id: 'n-valid', path: 'd-valid.md', format: 'markdown', bytes: body('valid') },
  { id: 'n-frozen', path: 'e-frozen.md', format: 'markdown', bytes: body('frozen') },
]

const asMap = (files: ReadonlyMap<string, Uint8Array | string>): Map<string, Uint8Array> =>
  new Map([...files].map(([p, v]) => [p, typeof v === 'string' ? enc.encode(v) : v]))

describe('B1 — the travel law survives the PACKAGE path, not only the tree path', () => {
  it('a frozen export carries three of five, and still three after emit → seal → parse → export', async () => {
    const direct = parseKoineTree(await emitKoineTree({ nodes: FIVE }, { frozenSlice: true }))
    expect(direct.nodes.map(n => n.id)).toEqual(['n-undeclared', 'n-valid', 'n-frozen'])

    // Seal the LIVING clone, then re-export a frozen slice from what came back.
    // Before 0.7.0 this returned all five — including the draft the gate refused
    // — because sealPackage rebuilt the map from files and kept four fields.
    const living = asMap(await emitKoineTree({ nodes: FIVE }))
    living.set('koine.json', enc.encode(JSON.stringify({
      koine: '0', name: 'five', version: '1.0.0', integrity: `sha256:${'0'.repeat(64)}`,
    })))
    const { manifest } = await sealPackage(living, { now: new Date('2026-09-17T00:00:00Z') })
    living.set('koine.json', enc.encode(serializeManifest(manifest)))

    const sealed = parseKoineTree(living)
    expect(sealed.nodes.map(n => [n.id, n.state])).toEqual([
      ['n-undeclared', undefined],
      ['n-spoken', 'spoken'],
      ['n-draft', 'draft'],
      ['n-valid', 'valid'],
      ['n-frozen', 'frozen'],
    ])

    const again = parseKoineTree(await emitKoineTree({
      nodes: sealed.nodes.map(n => ({
        id: n.id,
        path: n.path,
        format: n.format,
        bytes: sealed.bodies.get(n.path) as string,
      })),
    }, { frozenSlice: true }))
    expect(again.nodes.map(n => n.id)).toEqual(['n-undeclared', 'n-valid', 'n-frozen'])
  })

  it('a declared absence survives the seal, and a REQUIRED one blocks activation', async () => {
    const files = asMap(await emitKoineTree({
      nodes: [
        { id: 'n-doc', path: 'report.md', format: 'markdown', bytes: '# Report\n' },
        {
          id: 'n-scan',
          path: 'evidence/scan.pdf',
          format: 'pdf',
          contentHash: await hash('a large scan\n'),
          absent: { reason: 'oversize', required: true },
        },
      ],
      requires: ['absent-body'],
    }))
    files.set('koine.json', enc.encode(JSON.stringify({
      koine: '0', name: 'evidence', version: '1.0.0', integrity: `sha256:${'0'.repeat(64)}`,
      requires: ['absent-body'],
    })))
    const { manifest } = await sealPackage(files, { now: new Date('2026-09-17T00:00:00Z') })
    files.set('koine.json', enc.encode(serializeManifest(manifest)))

    // The row is still there — before 0.7.0 it was deleted by the seal, because
    // the map was rebuilt from files and an absent body has no file.
    const row = parseKoineTree(files).nodes.find(n => n.id === 'n-scan')
    expect(row?.absent).toEqual({ reason: 'oversize', required: true })
    expect(row?.contentHash).toBe(await hash('a large scan\n'))

    // …and the package check says so, rather than reporting `ok` with nothing missing.
    const inspection = await inspectFiles(files)
    expect(inspection.status).toBe('incomplete')
    expect(inspection.absent).toEqual([
      { id: 'n-scan', path: 'evidence/scan.pdf', contentHash: await hash('a large scan\n'), reason: 'oversize', required: true },
    ])
    // A declared absence is NOT drift: the package said so.
    expect(inspection.report?.missing).toEqual([])
  })

  it('a non-required absence is reported and does not block', async () => {
    const files = asMap(await emitKoineTree({
      nodes: [
        { id: 'n-doc', path: 'report.md', format: 'markdown', bytes: '# Report\n' },
        { id: 'n-extra', path: 'extra.bin', format: 'bin', contentHash: await hash('x'), absent: { reason: 'by-reference' } },
      ],
      requires: ['absent-body'],
    }))
    files.set('koine.json', enc.encode(JSON.stringify({
      koine: '0', name: 'e', version: '1.0.0', integrity: `sha256:${'0'.repeat(64)}`, requires: ['absent-body'],
    })))
    const { manifest } = await sealPackage(files, { now: new Date('2026-09-17T00:00:00Z') })
    files.set('koine.json', enc.encode(serializeManifest(manifest)))
    const inspection = await inspectFiles(files)
    expect(inspection.status).toBe('ok')
    expect(inspection.absent?.[0]?.required).toBe(false)
  })

  it('refuses to seal a body whose shape block contradicts its identity-map row', async () => {
    const files = asMap(await emitKoineTree({
      nodes: [{ id: 'n-x', path: 'x.md', format: 'markdown', bytes: body('valid') }],
    }))
    files.set('x.md', enc.encode(body('draft')))
    files.set('koine.json', enc.encode(JSON.stringify({
      koine: '0', name: 'x', version: '1.0.0', integrity: `sha256:${'0'.repeat(64)}`,
    })))
    await expect(sealPackage(files)).rejects.toThrow(/shape block/)
  })
})

describe('B2 — an agent author without a mandate is refused', () => {
  const HUMAN = new Uint8Array(32).map((_, i) => (i + 1) % 251 || 7)
  const AGENT = new Uint8Array(32).map((_, i) => (i * 7 + 13) % 251 || 11)
  const HUMAN_PUB = schnorr.getPublicKey(HUMAN)
  const AGENT_PUB = schnorr.getPublicKey(AGENT)
  const subject = { grain: 'chain-head', hash: 'a'.repeat(64) } as const

  const payload = (over: Partial<KoineSealPayload> = {}): KoineSealPayload => ({
    koine: '0',
    kind: 'koine/seal@v0',
    method: 'bip340',
    pubkey: hex(HUMAN_PUB),
    npub: encodeNpub(HUMAN_PUB),
    author: 'actor:user:owner',
    signedAt: '2026-09-17T12:00:00Z',
    subject,
    ...over,
  })

  it('refuses a correctly signed agent seal that carries no delegation certificate', async () => {
    // The reviewer's exact probe: a valid signature, `author: actor:agent:…`,
    // no certificate. It verified `valid: true` before 0.7.0 — the missing
    // mandate read exactly like a satisfied one.
    const envelope = await sealEnvelope(
      payload({ pubkey: hex(AGENT_PUB), npub: encodeNpub(AGENT_PUB), author: 'actor:agent:review-test' }),
      SEAL_PAYLOAD_TYPE, sign, AGENT,
    )
    expect(await verifySeal(envelope, subject, verify)).toEqual({ valid: false, reason: 'delegation-missing' })
  })

  it('the two controls the reviewer ran still hold', async () => {
    const human = await sealEnvelope(payload(), SEAL_PAYLOAD_TYPE, sign, HUMAN)
    expect((await verifySeal(human, subject, verify)).valid).toBe(true)

    const tampered = { ...human, signatures: [{ sig: (human.signatures[0] as { sig: string }).sig.replace(/^./, 'A') }] }
    expect((await verifySeal(tampered, subject, verify)).valid).toBe(false)
  })

  it('accepts the same agent seal once its mandate travels with it', async () => {
    const certificate = await sealEnvelope({
      koine: '0', kind: 'koine/delegation@v0', method: 'bip340',
      agent: 'actor:agent:review-test', agentPubkey: hex(AGENT_PUB),
      by: 'actor:user:owner', byPubkey: hex(HUMAN_PUB), byNpub: encodeNpub(HUMAN_PUB),
      issuedAt: '2026-09-01T00:00:00Z',
    }, DELEGATION_PAYLOAD_TYPE, sign, HUMAN)
    const envelope = await sealEnvelope(
      payload({
        pubkey: hex(AGENT_PUB), npub: encodeNpub(AGENT_PUB),
        author: 'actor:agent:review-test', delegation: certificate,
      }),
      SEAL_PAYLOAD_TYPE, sign, AGENT,
    )
    expect((await verifySeal(envelope, subject, verify)).valid).toBe(true)
  })
})

describe('B3 — the package seal binds the manifest’s papers', () => {
  const KEY = new Uint8Array(32).map((_, i) => (i + 1) % 251 || 7)
  const PUB = schnorr.getPublicKey(KEY)

  const manifest = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
    koine: '0',
    name: 'priced',
    version: '1.0.0',
    license: 'CC-BY-4.0',
    source: { type: 'git', url: 'https://github.com/acme/priced', ref: 'a1b2c3d4' },
    requires: ['absent-body'],
    status: 'https://acme.example/status.json',
    integrity: `sha256:${'a'.repeat(64)}`,
    provenance: { published_by: 'acme', method: 'bip340', signature: null },
    ...over,
  })

  const sealFor = async (m: Record<string, unknown>) => {
    const subject = packageSubject(
      m['name'] as string, m['version'] as string, m['integrity'] as KoineContentHash,
      await manifestPapers(m),
    )
    const envelope = await sealEnvelope({
      koine: '0', kind: 'koine/seal@v0', method: 'bip340',
      pubkey: hex(PUB), npub: encodeNpub(PUB), author: 'actor:user:acme',
      signedAt: '2026-09-17T12:00:00Z', subject,
    }, SEAL_PAYLOAD_TYPE, sign, KEY)
    return { envelope, subject }
  }

  it('a seal over the original papers does not verify against amended ones', async () => {
    const { envelope } = await sealFor(manifest())
    // The reviewer changed exactly these two and the signature stayed valid.
    for (const amended of [
      manifest({ license: 'proprietary' }),
      manifest({ source: { type: 'git', url: 'https://evil.example/priced', ref: 'a1b2c3d4' } }),
      manifest({ requires: [] }),
      manifest({ status: 'https://evil.example/status.json' }),
    ]) {
      const subject = packageSubject(
        amended['name'] as string, amended['version'] as string,
        amended['integrity'] as KoineContentHash, await manifestPapers(amended),
      )
      expect((await verifySeal(envelope, subject, verify)).reason).toBe('subject-mismatch')
    }
  })

  it('verifies against the papers it was made over', async () => {
    const { envelope, subject } = await sealFor(manifest())
    expect((await verifySeal(envelope, subject, verify)).valid).toBe(true)
  })

  it('the signature field itself is outside the digest, so sealing is not circular', async () => {
    const unsigned = manifest()
    const signed = manifest({ provenance: { published_by: 'acme', method: 'bip340', signature: 'DEADBEEF' } })
    expect(await manifestPapers(signed)).toBe(await manifestPapers(unsigned))
  })

  it('the digest is stable across key order, because a manifest is re-serialized by whoever reads it', async () => {
    const a = { koine: '0', name: 'x', version: '1', integrity: 'sha256:0' }
    const b = { integrity: 'sha256:0', version: '1', name: 'x', koine: '0' }
    expect(await manifestPapers(a)).toBe(await manifestPapers(b))
  })
})

describe('B4 — one call composes the five checks, and names the one that refused', () => {
  const pkg = async (over: { requires?: string[]; nodes?: unknown[] } = {}) => {
    const files = asMap(await emitKoineTree({
      nodes: (over.nodes ?? [{ id: 'n-a', path: 'a.md', format: 'markdown', bytes: '# A\n' }]) as never,
      ...(over.requires !== undefined ? { requires: over.requires } : {}),
    }))
    files.set('koine.json', enc.encode(JSON.stringify({
      koine: '0', name: 'p', version: '1.0.0', integrity: `sha256:${'0'.repeat(64)}`,
      ...(over.requires !== undefined ? { requires: over.requires } : {}),
    })))
    const { manifest } = await sealPackage(files, { now: new Date('2026-09-17T00:00:00Z') })
    files.set('koine.json', enc.encode(serializeManifest(manifest)))
    return files
  }

  it('admits a sound package, and says plainly that origin was not established', async () => {
    const verdict = await admitPackage(await pkg(), { implements: [] })
    expect(verdict.admitted).toBe(true)
    expect(verdict.refusedAt).toBeUndefined()
    // Additive, never a gate (§6.2) — and never silently absent either.
    expect(verdict.origin.status).toBe('not-established')
  })

  it('REFUSES for a capability it does not implement — the step the pieces could not do', async () => {
    // `checkCapabilities` could always name this. Nothing refused the artifact
    // for it, which made the must-understand rule a suggestion in practice.
    const verdict = await admitPackage(await pkg({ requires: ['locator'] }), { implements: [] })
    expect(verdict.admitted).toBe(false)
    expect(verdict.refusedAt).toBe('capabilities')
    expect(verdict.reasons.join(' ')).toContain('"locator"')
  })

  it('admits the same package once the reader implements it', async () => {
    const verdict = await admitPackage(await pkg({ requires: ['locator'] }), { implements: ['locator'] })
    expect(verdict.admitted).toBe(true)
  })

  it('refuses at COMPLETENESS when a required body is declared absent', async () => {
    const files = await pkg({
      requires: ['absent-body'],
      nodes: [
        { id: 'n-a', path: 'a.md', format: 'markdown', bytes: '# A\n' },
        { id: 'n-x', path: 'x.pdf', format: 'pdf', contentHash: await hash('big\n'), absent: { required: true } },
      ],
    })
    const verdict = await admitPackage(files, { implements: ['absent-body'] })
    expect(verdict.admitted).toBe(false)
    expect(verdict.refusedAt).toBe('completeness')
  })

  it('refuses at INTEGRITY when a byte moved, and capability order does not hide it', async () => {
    const files = await pkg()
    files.set('a.md', enc.encode('# tampered\n'))
    const verdict = await admitPackage(files, { implements: [] })
    expect(verdict.admitted).toBe(false)
    expect(verdict.refusedAt).toBe('integrity')
  })

  it('names the steps it did NOT run, rather than omitting them', async () => {
    // This test asserted `verdict.tree?.integrity.status === 'pass'` until B12,
    // which is to say it encoded the defect: the semantic checks ran after a
    // capability refusal, producing verdicts the reader was not entitled to.
    // They no longer run — and the skip is NAMED, because a verdict that simply
    // omitted them would read, at every call site, exactly like one where they
    // passed.
    const verdict = await admitPackage(await pkg({ requires: ['locator'] }), { implements: [] })
    expect(verdict.refusedAt).toBe('capabilities')
    expect(verdict.notRun).toEqual(['schema', 'references', 'completeness', 'origin'])
    expect(verdict.tree).toBeUndefined()
    // What WAS established before the refusal is still carried through.
    expect(verdict.package.status).toBe('ok')
    expect(verdict.capabilities.missing).toEqual(['locator'])
  })
})
