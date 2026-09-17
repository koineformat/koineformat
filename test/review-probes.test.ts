/**
 * The reviewer's counter-probes — B5, B6 and B7, each as the reporter wrote it.
 *
 * These are NOT this project's own fixtures restated. Each one is the
 * reproduction an outside reader ran against the published 0.6.0 distribution on
 * 2026-09-17, kept in the reporter's framing so the test that closes a finding
 * can still be read against the report that opened it.
 *
 * Why that matters enough to say: every defect below passed this package's own
 * 212 green tests. A suite written by the people who wrote the code tests what
 * they meant; a probe written by someone trying to USE it tests what it does.
 *
 * @see the 2026-09-17 DW-Atlas review of koineformat 0.6.0
 */

import { describe, expect, it } from 'bun:test'

import { emitKoineTree, parseKoineTree } from '../src/tree.js'
import { emitRecordTypeJson, parseRecordTypeJson } from '../src/dictionaries.js'
import { validateAgainstSchema } from '../src/schema.js'
import { PROPOSAL_FORMAT, acceptProposal, receiveProposal, type KoineProposal } from '../src/proposal.js'
import { sha256Hex } from '../src/sha256.js'
import type { KoineContentHash } from '../src/types.js'

const hash = async (b: string): Promise<KoineContentHash> => `sha256:${await sha256Hex(b)}`

const RECORD = {
  name: 'note',
  schema: {
    type: 'object',
    properties: { kind: { const: 'note' }, title: { type: 'string' } },
    required: ['kind'],
  },
}

const BODY = '# A note\n\n```shape\nkind: note\ntitle: first\n```\n'

async function treeAt(path: string) {
  const files = await emitKoineTree({
    nodes: [{ id: 'n-note', path, format: 'markdown', bytes: BODY }],
    commits: [{ seq: 1, actor: 'actor:user:o', what: 'wrote', why: 'fixture', when: '2026-09-01T00:00:00Z', node: 'n-note' }],
    types: { records: [RECORD] },
  })
  return { files, tree: parseKoineTree(files) }
}

const proposal = async (over: Partial<KoineProposal> = {}, path = 'current-name.md'): Promise<KoineProposal> => {
  const { tree } = await treeAt(path)
  return {
    format: PROPOSAL_FORMAT,
    target: { nodeId: 'n-note', path, baseContentHash: await hash(BODY) },
    baseChainHead: tree.chain?.links.at(-1)?.hash as string,
    schema: 'koine/types/note@v0',
    proposer: 'actor:user:reviewer',
    when: '2026-09-17T00:00:00Z',
    rationale: 'retitle',
    changes: [{ field: 'title', from: 'first', to: 'second' }],
    resultingShape: { kind: 'note', title: 'second' },
    ...over,
  }
}

describe('B5 — the proposal’s declared target and schema are actually used', () => {
  it('refuses a proposal whose declared schema id does not exist', async () => {
    const { files, tree } = await treeAt('current-name.md')
    const receipt = receiveProposal(
      await proposal({ schema: 'koine/types/does-not-exist@v0' }),
      tree,
      files,
    )
    // Before 0.7.0 this was `ready`: the record type was resolved from
    // `resultingShape.kind` alone and the declared `schema` was never read.
    expect(receipt.status).toBe('invalid')
    expect(receipt.problems.join(' ')).toContain('does-not-exist')
  })

  it('refuses a proposal whose declared schema names a different type than it changes', async () => {
    const { files, tree } = await treeAt('current-name.md')
    const receipt = receiveProposal(await proposal({ schema: 'koine/types/other@v0' }), tree, files)
    expect(receipt.status).toBe('invalid')
    expect(receipt.problems.join(' ')).toContain('one of the two is wrong')
  })

  it('binds acceptance to the RESOLVED path when the document was renamed', async () => {
    // The reviewer's second case: the proposal names `old-name.md`, the tree
    // holds the node at `current-name.md`, the id resolves — and acceptance used
    // to return the OLD path as the write target, creating a stale twin and
    // leaving the real body untouched.
    const { files, tree } = await treeAt('current-name.md')
    const drafted = await proposal({}, 'current-name.md')
    const stale: KoineProposal = { ...drafted, target: { ...drafted.target, path: 'old-name.md' } }

    const receipt = receiveProposal(stale, tree, files)
    expect(receipt.status).toBe('ready')
    // The rename is reported rather than silently absorbed: a receiver that
    // re-points without saying so hides a fact the decider may want.
    expect(receipt.resolved).toEqual({ nodeId: 'n-note', path: 'current-name.md', renamed: true })

    const accepted = acceptProposal(stale, { path: receipt.resolved?.path as string, body: BODY }, '2026-09-17T09:00:00Z')
    expect(accepted.path).toBe('current-name.md')
  })

  it('reports no rename when there was none', async () => {
    const { files, tree } = await treeAt('current-name.md')
    expect(receiveProposal(await proposal(), tree, files).resolved?.renamed).toBe(false)
  })
})

describe('B6 — a boolean IS a schema, and key order is not a fact about a value', () => {
  it('`{"not": false}` admits every value', () => {
    // `false` matches nothing, so "must not match nothing" is always satisfied.
    // This rejected everything before 0.7.0.
    expect(validateAgainstSchema('anything', { not: false })).toEqual([])
    expect(validateAgainstSchema(42, { not: false })).toEqual([])
  })

  it('`{"not": true}` admits no value', () => {
    expect(validateAgainstSchema('anything', { not: true })).not.toEqual([])
  })

  it('`properties: {"forbidden": false}` rejects the forbidden key', () => {
    const schema = { type: 'object', properties: { forbidden: false } }
    expect(validateAgainstSchema({ forbidden: 'x' }, schema)).not.toEqual([])
    // …and says nothing about an object that simply does not carry it.
    expect(validateAgainstSchema({ other: 'x' }, schema)).toEqual([])
  })

  it('`items: false` rejects a non-empty array and admits an empty one', () => {
    expect(validateAgainstSchema([1], { type: 'array', items: false })).not.toEqual([])
    expect(validateAgainstSchema([], { type: 'array', items: false })).toEqual([])
  })

  it('an object `const` accepts the same object in a different key order', () => {
    const schema = { const: { a: 1, b: { c: 2, d: 3 } } }
    expect(validateAgainstSchema({ b: { d: 3, c: 2 }, a: 1 }, schema)).toEqual([])
    // …and still rejects a different value.
    expect(validateAgainstSchema({ a: 1, b: { c: 2, d: 4 } }, schema)).not.toEqual([])
  })

  it('an `enum` of objects is order-insensitive for the same reason', () => {
    expect(validateAgainstSchema({ y: 2, x: 1 }, { enum: [{ x: 1, y: 2 }] })).toEqual([])
  })

  it('array order still MATTERS — only object keys are unordered', () => {
    expect(validateAgainstSchema([1, 2], { const: [2, 1] })).not.toEqual([])
  })
})

describe('B7 — an existing schema $id survives the typed round trip', () => {
  const PILOT = { $id: 'urn:example:pilot:1', type: 'object', properties: { kind: { const: 'pilot' } } }

  it('keeps the author’s id through emit → parse → emit', () => {
    const first = emitRecordTypeJson({ name: 'pilot', schema: PILOT })
    expect(JSON.parse(first)['$id']).toBe('urn:example:pilot:1')

    const parsed = parseRecordTypeJson('pilot', JSON.parse(first) as Record<string, unknown>)
    const second = emitRecordTypeJson(parsed)
    // Before 0.7.0 this read `koine/types/pilot@v0`: the emitter accepted the
    // foreign id and the parser then threw it away, so the codec substituted a
    // different identifier for the one it had been given.
    expect(JSON.parse(second)['$id']).toBe('urn:example:pilot:1')
    expect(second).toBe(first)
  })

  it('still stamps koine’s id where the schema carries none', () => {
    const emitted = emitRecordTypeJson({ name: 'note', schema: { type: 'object' } })
    expect(JSON.parse(emitted)['$id']).toBe('koine/types/note@v0')
    // …and the stamp is stripped on the way back, so it never accumulates.
    expect(parseRecordTypeJson('note', JSON.parse(emitted) as Record<string, unknown>).schema).toEqual({
      type: 'object',
    })
  })

  it('survives a whole-tree crossing, which is where the reviewer met it', async () => {
    const files = await emitKoineTree({
      nodes: [{ id: 'n-a', path: 'a.md', format: 'markdown', bytes: 'x\n' }],
      types: { records: [{ name: 'pilot', schema: PILOT }] },
    })
    const parsed = parseKoineTree(files)
    const again = await emitKoineTree({
      nodes: [{ id: 'n-a', path: 'a.md', format: 'markdown', bytes: 'x\n' }],
      types: parsed.dictionaries,
    })
    expect(again.get('.koine/types/pilot.schema.json')).toBe(files.get('.koine/types/pilot.schema.json') as string)
    expect(parsed.dictionaries.records?.[0]?.schema['$id']).toBe('urn:example:pilot:1')
  })
})
