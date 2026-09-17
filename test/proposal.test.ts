/**
 * The crossing — the §5 receiver's receipts.
 *
 * Chapter 5 declared receipt semantics normative in five ordered steps and
 * shipped a schema, a worked example, and no implementation on either side of
 * the boundary. These are the five steps, each as a test, plus the two defects
 * found beside them: `changes[].from`/`.to` admitting strings only while
 * `resultingShape` carries general JSON, and the two grains — field-wise here,
 * text-range in a live editor — unable to express each other.
 */

import { describe, expect, it } from 'bun:test'
import { emitKoineTree, parseKoineTree } from '../src/tree.js'
import {
  BODY_FIELD,
  PROPOSAL_FORMAT,
  acceptProposal,
  receiveProposal,
  validateProposalEnvelope,
  type KoineProposal,
} from '../src/proposal.js'
import { sha256Hex } from '../src/sha256.js'
import type { KoineContentHash } from '../src/types.js'

const hash = async (b: string): Promise<KoineContentHash> => `sha256:${await sha256Hex(b)}`

const RECORD = {
  name: 'metric-definition',
  schema: {
    type: 'object',
    properties: {
      kind: { const: 'metric-definition' },
      state: { enum: ['spoken', 'draft', 'valid', 'frozen'] },
      filter: { type: 'string' },
      window: { type: 'integer' },
      unit: { enum: ['count', 'rate'] },
      denominator: { type: 'string' },
      thresholds: { type: 'object' },
    },
    required: ['kind'],
    if: { properties: { unit: { const: 'rate' } }, required: ['unit'] },
    then: { required: ['denominator'] },
  },
} as const

const BODY = [
  '# Active Member',
  '',
  'Prose above the block, and prose below it, both untouched by acceptance.',
  '',
  '```shape',
  'kind: metric-definition',
  'filter: qualifying-act within 90d',
  'window: 90',
  'unit: count',
  'state: valid',
  '```',
  '',
  'The trailing prose.',
  '',
].join('\n')

async function fixture(body = BODY) {
  const files = await emitKoineTree({
    nodes: [{ id: 'n-def', path: 'definitions/active-member.md', format: 'markdown', bytes: body }],
    commits: [
      { seq: 1, actor: 'actor:user:owner', what: 'wrote it', why: 'fixture', when: '2026-09-01T00:00:00Z', node: 'n-def' },
    ],
    types: { records: [RECORD] },
  })
  const tree = parseKoineTree(files)
  return { files, tree, head: tree.chain?.links.at(-1)?.hash as string }
}

const proposal = async (over: Partial<KoineProposal> = {}, body = BODY): Promise<KoineProposal> => {
  const { head } = await fixture(body)
  return {
    format: PROPOSAL_FORMAT,
    target: {
      nodeId: 'n-def',
      path: 'definitions/active-member.md',
      baseContentHash: await hash(body),
    },
    baseChainHead: head,
    schema: 'koine/types/metric-definition@v0',
    proposer: 'actor:agent:noe',
    when: '2026-09-17T00:00:00Z',
    rationale: 'Narrow the window.',
    changes: [
      { field: 'filter', from: 'qualifying-act within 90d', to: 'qualifying-act within 60d' },
      { field: 'window', from: 90, to: 60 },
    ],
    resultingShape: {
      kind: 'metric-definition',
      filter: 'qualifying-act within 60d',
      window: 60,
      unit: 'count',
      state: 'valid',
    },
    ...over,
  }
}

describe('R1 — a well-formed proposal produces the conflict list, and each change is classified', () => {
  it('is ready and clean when nothing moved under it', async () => {
    const { tree, files } = await fixture()
    const receipt = receiveProposal(await proposal(), tree, files)
    expect(receipt.status).toBe('ready')
    expect(receipt.conflicts).toEqual([])
    expect(receipt.problems).toEqual([])
  })

  it('classifies a field the holder also moved as both-intentional', async () => {
    const moved = BODY.replace('filter: qualifying-act within 90d', 'filter: qualifying-act within 30d')
    const { tree, files } = await fixture(moved)
    // The proposal was drafted against the ORIGINAL text, so re-base its hashes
    // — this test is about the field, not about staleness.
    const p = { ...(await proposal()), target: { ...(await proposal()).target, baseContentHash: await hash(moved) } }
    const receipt = receiveProposal(
      { ...p, baseChainHead: tree.chain?.links.at(-1)?.hash as string },
      tree,
      files,
    )
    expect(receipt.status).toBe('ready')
    expect(receipt.conflicts.map((c) => [c.field, c.kind])).toEqual([['filter', 'both-intentional']])
    expect(receipt.conflicts[0]?.current).toBe('qualifying-act within 30d')
  })

  it('classifies a change the SHAPE convicts as one-is-wrong — no human needed', async () => {
    // A rate with no denominator: §5's own worked example of the shape itself
    // convicting a candidate.
    const { tree, files } = await fixture()
    const receipt = receiveProposal(
      await proposal({
        changes: [{ field: 'unit', from: 'count', to: 'rate' }],
        resultingShape: {
          kind: 'metric-definition',
          filter: 'qualifying-act within 90d',
          window: 90,
          unit: 'rate',
          state: 'valid',
        },
      }),
      tree,
      files,
    )
    expect(receipt.conflicts.map((c) => c.kind)).toEqual(['one-is-wrong'])
    expect(receipt.problems.join(' ')).toContain('denominator')
  })

  it('carries the proposer’s open questions to the decider instead of resolving them', async () => {
    const { tree, files } = await fixture()
    const receipt = receiveProposal(
      await proposal({ openQuestions: [{ field: 'state', question: 'Who applies this?' }] }),
      tree,
      files,
    )
    expect(receipt.openQuestions).toEqual([{ field: 'state', question: 'Who applies this?' }])
  })
})

describe('R2 — a stale proposal is returned or re-based, never force-applied', () => {
  it('detects a moved body', async () => {
    const { tree, files } = await fixture()
    const receipt = receiveProposal(
      await proposal({
        target: {
          nodeId: 'n-def',
          path: 'definitions/active-member.md',
          baseContentHash: await hash('something else\n'),
        },
      }),
      tree,
      files,
    )
    expect(receipt.status).toBe('stale')
    expect(receipt.problems[0]).toContain('the body moved')
  })

  it('detects a moved chain head even when the body is untouched', async () => {
    const { tree, files } = await fixture()
    const receipt = receiveProposal(await proposal({ baseChainHead: 'f'.repeat(64) }), tree, files)
    expect(receipt.status).toBe('stale')
    expect(receipt.problems[0]).toContain('history moved')
  })
})

describe('R3 — a proposal whose recomputed diff does not equal its changes is rejected, naming the field', () => {
  it('convicts an undeclared change', async () => {
    const { tree, files } = await fixture()
    const receipt = receiveProposal(
      await proposal({ changes: [{ field: 'filter', from: 'qualifying-act within 90d', to: 'qualifying-act within 60d' }] }),
      tree,
      files,
    )
    expect(receipt.status).toBe('inconsistent')
    expect(receipt.problems.join(' ')).toContain('"window" changes and the proposal does not declare it')
  })

  it('convicts a declared change that does not happen', async () => {
    const { tree, files } = await fixture()
    const receipt = receiveProposal(
      await proposal({
        changes: [
          { field: 'filter', from: 'qualifying-act within 90d', to: 'qualifying-act within 60d' },
          { field: 'window', from: 90, to: 60 },
          { field: 'unit', from: 'count', to: 'rate' },
        ],
      }),
      tree,
      files,
    )
    expect(receipt.status).toBe('inconsistent')
    expect(receipt.problems.join(' ')).toContain('"unit" is declared to change and does not')
  })
})

describe('R4 — a change to a number and a change to a nested object round-trip through the envelope', () => {
  it('accepts non-string from/to, which the v0 schema could not express', async () => {
    expect(validateProposalEnvelope({
      ...(await proposal()),
      changes: [{ field: 'thresholds', from: null, to: { warn: 3, fail: 7 } }],
      resultingShape: {
        kind: 'metric-definition',
        filter: 'qualifying-act within 90d',
        window: 90,
        unit: 'count',
        state: 'valid',
        thresholds: { warn: 3, fail: 7 },
      },
    })).toEqual([])
  })

  it('recomputes a nested diff correctly end to end', async () => {
    const { tree, files } = await fixture()
    const receipt = receiveProposal(
      await proposal({
        changes: [{ field: 'thresholds', from: undefined, to: { warn: 3, fail: 7 } }],
        resultingShape: {
          kind: 'metric-definition',
          filter: 'qualifying-act within 90d',
          window: 90,
          unit: 'count',
          state: 'valid',
          thresholds: { warn: 3, fail: 7 },
        },
      }),
      tree,
      files,
    )
    expect(receipt.status).toBe('ready')
    expect(receipt.conflicts).toEqual([])
  })

  it('expresses an ADDITION by omitting from, and a removal by omitting to', async () => {
    // JSON cannot write "not there" as a value, so the key's presence carries
    // it — and `null` stays the JSON value null, which is a different fact.
    expect(validateProposalEnvelope({
      ...(await proposal()),
      changes: [{ field: 'thresholds', to: { warn: 3 } }],
      resultingShape: {
        kind: 'metric-definition',
        filter: 'qualifying-act within 90d',
        window: 90,
        unit: 'count',
        state: 'valid',
        thresholds: { warn: 3 },
      },
    })).toEqual([])
    expect(validateProposalEnvelope({ ...(await proposal()), changes: [{ field: 'window' }] })
      .some((p) => p.includes('omits both'))).toBe(true)
  })

  it('adds a field end to end, over the JSON wire form', async () => {
    const { tree, files } = await fixture()
    const receipt = receiveProposal(
      JSON.parse(JSON.stringify({
        ...(await proposal()),
        changes: [{ field: 'thresholds', to: { warn: 3, fail: 7 } }],
        resultingShape: {
          kind: 'metric-definition',
          filter: 'qualifying-act within 90d',
          window: 90,
          unit: 'count',
          state: 'valid',
          thresholds: { warn: 3, fail: 7 },
        },
      })),
      tree,
      files,
    )
    expect(receipt.status).toBe('ready')
    // The field was absent, not null — so this is an addition and not a conflict.
    expect(receipt.conflicts).toEqual([])
  })
})

describe('R5 — acceptance edits the body and appends ONE commit bound to that node', () => {
  it('rewrites the declarations, leaves the prose, and binds the commit', async () => {
    const p = await proposal()
    const accepted = acceptProposal(p, { path: 'definitions/active-member.md', body: BODY }, '2026-09-17T09:00:00Z')
    expect(accepted.bytes).toContain('filter: qualifying-act within 60d')
    expect(accepted.bytes).toContain('window: 60')
    expect(accepted.bytes).toContain('Prose above the block')
    expect(accepted.bytes).toContain('The trailing prose.')
    expect(accepted.commit.node).toBe('n-def')
    expect(accepted.commit.actor).toBe('actor:agent:noe')
  })

  it('recomputes the node’s contentHash by re-emitting — the ritual §5 describes, verified', async () => {
    const p = await proposal()
    const accepted = acceptProposal(p, { path: 'definitions/active-member.md', body: BODY }, '2026-09-17T09:00:00Z')
    const files = await emitKoineTree({
      nodes: [{ id: 'n-def', path: accepted.path, format: 'markdown', bytes: accepted.bytes }],
      commits: [
        { seq: 1, actor: 'actor:user:owner', what: 'wrote it', why: 'fixture', when: '2026-09-01T00:00:00Z', node: 'n-def' },
        { seq: 2, ...accepted.commit },
      ],
      types: { records: [RECORD] },
    })
    const tree = parseKoineTree(files)
    expect(tree.nodes[0]?.contentHash).toBe(await hash(accepted.bytes))
    expect(tree.commits.at(-1)?.node).toBe('n-def')
    expect(tree.chain?.links).toHaveLength(2)
    // …and the accepted proposal is now stale against the tree it was applied to,
    // which is how a second holder learns not to apply it twice.
    expect(receiveProposal(p, tree, files).status).toBe('stale')
  })
})

describe('the two grains meet — a text-range proposal and a field-wise one, one envelope', () => {
  it('receives a body proposal addressed by a Locator', async () => {
    const { tree, files } = await fixture()
    const p: KoineProposal = {
      ...(await proposal()),
      target: {
        nodeId: 'n-def',
        path: 'definitions/active-member.md',
        baseContentHash: await hash(BODY),
        selector: { type: 'text-quote', exact: 'The trailing prose.' },
      },
      changes: [{ field: BODY_FIELD, from: 'The trailing prose.', to: 'The amended trailing prose.' }],
      resultingShape: undefined,
    }
    expect(validateProposalEnvelope(p)).toEqual([])
    expect(receiveProposal(p, tree, files).status).toBe('ready')

    const accepted = acceptProposal(p, { path: 'definitions/active-member.md', body: BODY }, '2026-09-17T09:00:00Z')
    expect(accepted.bytes).toContain('The amended trailing prose.')
    expect(accepted.bytes).toContain('kind: metric-definition')
    expect(accepted.commit.node).toBe('n-def')
  })

  it('refuses a body proposal with no region — the grain is the point', async () => {
    const p = {
      ...(await proposal()),
      changes: [{ field: BODY_FIELD, from: 'a', to: 'b' }],
      resultingShape: undefined,
    }
    expect(validateProposalEnvelope(p).join(' ')).toContain('"target.selector" is required')
  })

  it('convicts a body proposal drafted against different text', async () => {
    const { tree, files } = await fixture()
    const p: KoineProposal = {
      ...(await proposal()),
      target: {
        nodeId: 'n-def',
        path: 'definitions/active-member.md',
        baseContentHash: await hash(BODY),
        selector: { type: 'text-quote', exact: 'The trailing prose.' },
      },
      changes: [{ field: BODY_FIELD, from: 'Some other text entirely', to: 'x' }],
      resultingShape: undefined,
    }
    const receipt = receiveProposal(p, tree, files)
    expect(receipt.status).toBe('inconsistent')
    expect(receipt.problems[0]).toContain('drafted against different text')
  })
})

describe('step 1 — the envelope', () => {
  it('names every structural defect at once', async () => {
    const problems = validateProposalEnvelope({ format: 'something-else', changes: [] })
    expect(problems.some((p) => p.includes('"format"'))).toBe(true)
    expect(problems.some((p) => p.includes('"target" is required'))).toBe(true)
    expect(problems.some((p) => p.includes('"changes" must be a non-empty array'))).toBe(true)
    expect(problems.some((p) => p.includes('"proposer"'))).toBe(true)
  })

  it('accepts the shipped worked example', async () => {
    const example = await Bun.file('examples/proposals/active-member-60d.proposal.json').json()
    expect(validateProposalEnvelope(example)).toEqual([])
  })
})
