import { describe, expect, it } from 'bun:test'
import {
  CHAIN_FORMAT,
  GENESIS_PREV,
  computeChain,
  emitChainJsonl,
  emitCommitsJsonl,
  emitEdgesJsonl,
  emitNodesJsonl,
  parseChainJsonl,
  parseCommitsJsonl,
  parseEdgesJsonl,
  parseNodesJsonl,
  verifyChain,
} from '../src/sidecars.js'
import { KoineParseError, type KoineNodeEntry } from '../src/types.js'

/**
 * Conformance vectors: the exact commit lines of the first real koine repo —
 * [`examples/own-docs/`](../examples/own-docs) in this repository — and the
 * chain values its Python emitter produced and `tools/verify.py` accepts. This
 * codec MUST reproduce them byte-for-byte: two independent implementations,
 * one normative algorithm (SPEC §3.3).
 */
const PILOT_COMMIT_LINES = [
  '{"seq":1,"actor":"actor:user:christiangruender","what":"found the room: README.md, definitions/koine-repo.md, definitions/active-member.md with declared shape (filter: qualifying-act within 90d, unit: count)","why":"S1 of the family plan — the smallest real koine repo, floors 0-2","when":"2026-07-30T23:12:04Z"}',
  '{"seq":2,"actor":"actor:agent:claude","what":"add data/decision.entries.jsonl — the nine ratified family decisions R1-R9 as entries","why":"the 2026-07-31 ratification recorded as data the room can answer from","when":"2026-07-30T23:31:47Z"}',
  '{"seq":3,"actor":"actor:agent:claude","what":"promote definitions/active-member.md from draft to valid; prose clarified on paused-member treatment","why":"owner review passed — the paused-members-included rule is intentional, not an omission","when":"2026-07-30T23:40:29Z"}',
] as const

const PILOT_COMMITS_JSONL = PILOT_COMMIT_LINES.map((l) => `${l}\n`).join('')

const PILOT_CHAIN = [
  {
    seq: 1,
    commit: '3b676c125cb3650dcbcda2defd205ffd3d90c8b10184a24ffd7f87ee97e85c60',
    prev: GENESIS_PREV,
    hash: '71d2b557dcddf22d4e30ab25bfc4844376ac01c17f7c16e144a6404f12755249',
  },
  {
    seq: 2,
    commit: '50d626e7ff8a415577a2773ae9345c3bed1e5b9f0206ab2902822169f3746dd9',
    prev: '71d2b557dcddf22d4e30ab25bfc4844376ac01c17f7c16e144a6404f12755249',
    hash: '6f6d0be96ed5c78678e258d1443bdd98be297ed6e1f27b4513a13e1bb85fde29',
  },
  {
    seq: 3,
    commit: '2347b4892c6aebdef290af02bd581fa62c06349ed0f985b17ce7a467a9da63a5',
    prev: '6f6d0be96ed5c78678e258d1443bdd98be297ed6e1f27b4513a13e1bb85fde29',
    hash: '07b5f4210f3660dd9ae086ad9111114123408ce8f85a98ad21a386be45dbc66d',
  },
]

describe('koine chain — conformance against the pilot', () => {
  it('reproduces the pilot chain byte-for-byte from the exact commit lines', async () => {
    const links = await computeChain(PILOT_COMMITS_JSONL)
    expect(links).toEqual(PILOT_CHAIN)
  })

  it('emit → parse round-trips the chain including the declared header', () => {
    const emitted = emitChainJsonl(PILOT_CHAIN)
    const parsed = parseChainJsonl(emitted)
    expect(parsed.header.format).toBe(CHAIN_FORMAT)
    expect(parsed.links).toEqual(PILOT_CHAIN)
    expect(emitChainJsonl(parsed.links)).toBe(emitted)
  })

  it('verifyChain passes the pilot and convicts a rewritten why-field', async () => {
    const chain = emitChainJsonl(await computeChain(PILOT_COMMITS_JSONL))
    expect(await verifyChain(PILOT_COMMITS_JSONL, chain)).toEqual({ ok: true, problems: [] })

    const tampered = PILOT_COMMITS_JSONL.replace(
      'the 2026-07-31 ratification recorded as data the room can answer from',
      'routine data import, nothing ratified',
    )
    const verdict = await verifyChain(tampered, chain)
    expect(verdict.ok).toBe(false)
    expect(verdict.problems.some((p) => p.includes('seq 2'))).toBe(true)
  })
})

describe('koine jsonl sidecars — round-trip', () => {
  const nodes: KoineNodeEntry[] = [
    { id: 'a'.repeat(24), path: 'definitions/one.md', format: 'markdown', contentHash: `sha256:${'1'.repeat(64)}` },
    { id: 'b'.repeat(24), path: 'data/rows.jsonl', format: 'entries', contentHash: `sha256:${'2'.repeat(64)}` },
  ]

  it('nodes: parse(emit(x)) equals x, and re-emit is byte-identical', () => {
    const emitted = emitNodesJsonl(nodes)
    const parsed = parseNodesJsonl(emitted)
    expect(parsed).toEqual(nodes)
    expect(emitNodesJsonl(parsed)).toBe(emitted)
  })

  it('edges and commits round-trip byte-identically', () => {
    const edges = [{ from: nodes[0]!.id, to: nodes[1]!.id, type: 'references' }]
    const emittedEdges = emitEdgesJsonl(edges)
    expect(emitEdgesJsonl(parseEdgesJsonl(emittedEdges))).toBe(emittedEdges)

    const emittedCommits = PILOT_COMMITS_JSONL
    expect(emitCommitsJsonl(parseCommitsJsonl(emittedCommits))).toBe(emittedCommits)
  })

  it('rejects a file without a terminating newline', () => {
    expect(() => parseNodesJsonl(emitNodesJsonl(nodes).slice(0, -1))).toThrow(KoineParseError)
  })

  it('rejects a malformed contentHash with the offending line number', () => {
    const bad = '{"id":"x","path":"p.md","format":"markdown","contentHash":"sha256:short"}\n'
    expect(() => parseNodesJsonl(bad)).toThrow(/nodes\.jsonl:1/)
  })

  it('rejects non-JSON and non-object lines', () => {
    expect(() => parseEdgesJsonl('not json\n')).toThrow(KoineParseError)
    expect(() => parseCommitsJsonl('[1,2]\n')).toThrow(/not a JSON object/)
  })
})
