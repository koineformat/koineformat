/**
 * The crossing — release 1's receipts. Covers SPEC §3.2 (the identity map and
 * the asserted graph), §3.4 (the Locator), §3.5 (the four verdicts) and §4.
 *
 * Each clause below is a law the form states about itself and could not survive
 * its own roundtrip. They are written as COMPOSITIONS on purpose: the suite
 * that shipped green over every one of these proved each law alone — the
 * roundtrip test re-emitted `nodes: input.nodes`, the original input, while
 * taking edges and commits from the parsed tree, so the one path that matters
 * (parse a foreign tree, then act on what you parsed) was never run.
 */

import { describe, expect, it } from 'bun:test'
import { emitKoineTree, parseKoineTree, verifyKoineTree } from '../src/tree.js'
import { resolveLocator } from '../src/locator.js'
import { KoineEmitError, type KoineContentHash, type KoineTreeInput } from '../src/types.js'
import { sha256Hex } from '../src/sha256.js'

const VALID_BODY = '# Active Member\n\n```shape\nkind: metric-definition\nstate: valid\n```\n'
const DRAFT_BODY = '# Half a thought\n\n```shape\nkind: metric-definition\nstate: draft\n```\n'

const hash = async (bytes: string): Promise<KoineContentHash> => `sha256:${await sha256Hex(bytes)}`

const RECORD = {
  name: 'metric-definition',
  schema: {
    type: 'object',
    properties: {
      kind: { const: 'metric-definition' },
      state: { enum: ['spoken', 'draft', 'valid', 'frozen'] },
      unit: { enum: ['count', 'rate'] },
      denominator: { type: 'string' },
      window: { type: 'integer' },
    },
    required: ['kind'],
    if: { properties: { unit: { const: 'rate' } }, required: ['unit'] },
    then: { required: ['denominator'] },
  },
} as const

const base: KoineTreeInput = {
  nodes: [
    { id: 'n-valid', path: 'definitions/active-member.md', format: 'markdown', bytes: VALID_BODY },
    { id: 'n-draft', path: 'notes/half.md', format: 'markdown', bytes: DRAFT_BODY },
  ],
  edges: [{ from: 'n-draft', to: 'n-valid', type: 'references' }],
  commits: [
    { seq: 1, actor: 'actor:user:owner', what: 'wrote the definition', why: 'fixture', when: '2026-09-01T00:00:00Z', node: 'n-valid' },
    { seq: 2, actor: 'actor:user:owner', what: 'started a thought', why: 'fixture', when: '2026-09-02T00:00:00Z', node: 'n-draft' },
  ],
  types: {
    records: [RECORD],
    edges: [{ name: 'references', description: 'cites', directed: true, transitive: false, weight: 'strength' }],
  },
}

describe('R1 — a node’s validity state survives emit → parse → emit', () => {
  it('carries the state in the identity map, read off the body’s own shape block', async () => {
    const parsed = parseKoineTree(await emitKoineTree(base))
    expect(parsed.nodes.map((n) => [n.id, n.state])).toEqual([
      ['n-valid', 'valid'],
      ['n-draft', 'draft'],
    ])
  })

  it('survives a second crossing — the state is in the bytes, not in the call', async () => {
    const parsed = parseKoineTree(await emitKoineTree(base))
    const again = parseKoineTree(
      await emitKoineTree({
        // Exactly what a foreign reader has: the parsed tree and nothing else.
        nodes: parsed.nodes.map((n) => ({
          id: n.id,
          path: n.path,
          format: n.format,
          bytes: parsed.bodies.get(n.path) as string,
        })),
        edges: [...parsed.edges],
        commits: [...parsed.commits],
        types: parsed.dictionaries,
      }),
    )
    expect(again.nodes.map((n) => n.state)).toEqual(['valid', 'draft'])
  })

  it('refuses a producer that contradicts its own body', async () => {
    await expect(
      emitKoineTree({ nodes: [{ id: 'n-1', path: 'a.md', format: 'markdown', bytes: VALID_BODY, state: 'draft' }] }),
    ).rejects.toThrow(/is declared "draft" by its producer and "valid" by its own shape block/)
  })
})

describe('R2 — a frozen slice built from PARSED input carries the valid nodes, not zero', () => {
  it('yields the valid node, where the old reading yielded nothing', async () => {
    const parsed = parseKoineTree(await emitKoineTree(base))
    const slice = await emitKoineTree(
      {
        nodes: parsed.nodes.map((n) => ({
          id: n.id,
          path: n.path,
          format: n.format,
          bytes: parsed.bodies.get(n.path) as string,
        })),
        edges: [...parsed.edges],
        commits: [...parsed.commits],
        types: parsed.dictionaries,
      },
      { frozenSlice: true },
    )
    expect(parseKoineTree(slice).nodes.map((n) => n.id)).toEqual(['n-valid'])
  })
})

describe('R3 — a frozen slice names nothing it withheld', () => {
  it('drops the excluded node’s history and renumbers what remains', async () => {
    const parsed = parseKoineTree(await emitKoineTree(base, { frozenSlice: true }))
    expect(parsed.commits).toEqual([
      { seq: 1, actor: 'actor:user:owner', what: 'wrote the definition', why: 'fixture', when: '2026-09-01T00:00:00Z', node: 'n-valid' },
    ])
    // The chain is the slice's own, over the slice's own commits — verifiable,
    // where a chain with a hole in it would not be.
    expect(parsed.chain?.links).toHaveLength(1)
    expect((await verifyKoineTree(await emitKoineTree(base, { frozenSlice: true }))).integrity.status).toBe('pass')
  })

  it('refuses a slice whose surviving prose still spells an excluded id', async () => {
    await expect(
      emitKoineTree(
        {
          ...base,
          commits: [
            {
              seq: 1,
              actor: 'actor:user:owner',
              what: 'superseded by n-draft',
              why: 'fixture',
              when: '2026-09-01T00:00:00Z',
              node: 'n-valid',
            },
          ],
        },
        { frozenSlice: true },
      ),
    ).rejects.toThrow(/names "n-draft", which the travel law kept out/)
  })

  it('does not convict a surviving id that merely contains an excluded one', async () => {
    // `n-draft` is excluded; `n-draft-2` survives. A substring scan would
    // refuse this slice, and refusing a correct artifact is its own defect.
    const slice = await emitKoineTree(
      {
        nodes: [
          ...base.nodes,
          { id: 'n-draft-2', path: 'definitions/second.md', format: 'markdown', bytes: VALID_BODY },
        ],
        commits: [
          { seq: 1, actor: 'actor:user:owner', what: 'see n-draft-2', why: 'fixture', when: '2026-09-01T00:00:00Z', node: 'n-valid' },
        ],
        types: base.types,
      },
      { frozenSlice: true },
    )
    expect(parseKoineTree(slice).nodes.map((n) => n.id)).toEqual(['n-valid', 'n-draft-2'])
  })
})

describe('R4 — a commit names its node in a declared field, and `what` is never parsed as an id', () => {
  it('carries the binding through the crossing and verifies it against the identity map', async () => {
    const parsed = parseKoineTree(await emitKoineTree(base))
    expect(parsed.commits.map((c) => c.node)).toEqual(['n-valid', 'n-draft'])
    const verdict = await verifyKoineTree(await emitKoineTree(base))
    expect(verdict.references.status).toBe('pass')
  })

  it('convicts a commit bound to a node the tree does not hold', async () => {
    const files = await emitKoineTree(base)
    const commits = files.get('.koine/history/commits.jsonl') as string
    const broken = new Map(files).set(
      '.koine/history/commits.jsonl',
      commits.replace('"node":"n-draft"', '"node":"n-ghost"'),
    )
    const verdict = await verifyKoineTree(broken)
    expect(verdict.references.status).toBe('fail')
    expect(verdict.references.problems.some((p) => p.includes('n-ghost'))).toBe(true)
    // …and the chain convicts the edit too, which is the point of having both.
    expect(verdict.integrity.status).toBe('fail')
  })
})

describe('R5 — verify answers four questions, and a body can fail its type while its bytes are intact', () => {
  it('reports integrity · schema · references · origin separately', async () => {
    const verdict = await verifyKoineTree(await emitKoineTree(base))
    expect(verdict.integrity.status).toBe('pass')
    expect(verdict.schema.status).toBe('pass')
    expect(verdict.references.status).toBe('pass')
    expect(verdict.origin.status).toBe('not-established')
  })

  it('fails the SCHEMA verdict while integrity passes', async () => {
    // A rate with no denominator — the shape convicts itself, and the bytes are
    // exactly what the identity map says they are.
    const body = '# Rate\n\n```shape\nkind: metric-definition\nunit: rate\n```\n'
    const verdict = await verifyKoineTree(
      await emitKoineTree({
        nodes: [{ id: 'n-rate', path: 'rate.md', format: 'markdown', bytes: body }],
        types: { records: [RECORD] },
      }),
    )
    expect(verdict.integrity.status).toBe('pass')
    expect(verdict.schema.status).toBe('fail')
    expect(verdict.schema.problems.some((p) => p.includes('denominator'))).toBe(true)
    expect(verdict.ok).toBe(false)
  })

  it('coerces a shape block’s text to the declared type before judging it', async () => {
    const good = '# W\n\n```shape\nkind: metric-definition\nwindow: 90\n```\n'
    const bad = '# W\n\n```shape\nkind: metric-definition\nwindow: ninety\n```\n'
    const of = async (bytes: string) =>
      (await verifyKoineTree(
        await emitKoineTree({
          nodes: [{ id: 'n-w', path: 'w.md', format: 'markdown', bytes }],
          types: { records: [RECORD] },
        }),
      )).schema
    expect((await of(good)).status).toBe('pass')
    expect((await of(bad)).status).toBe('fail')
    expect((await of(bad)).problems.some((p) => p.includes('window'))).toBe(true)
  })

  it('says `not-established`, not `pass`, when nothing declared itself', async () => {
    const verdict = await verifyKoineTree(
      await emitKoineTree({ nodes: [{ id: 'n-x', path: 'x.md', format: 'markdown', bytes: 'plain\n' }] }),
    )
    expect(verdict.schema.status).toBe('not-established')
    expect(verdict.ok).toBe(true)
  })
})

describe('the Locator — an endpoint may address a PART, and says which version it addressed', () => {
  it('survives emit → parse → emit byte-identically', async () => {
    const input: KoineTreeInput = {
      nodes: [
        { id: 'n-a', path: 'a.md', format: 'markdown', bytes: 'alpha beta gamma\n' },
        { id: 'n-b', path: 'b.md', format: 'markdown', bytes: 'the claim\n' },
      ],
      edges: [
        {
          from: 'n-b',
          to: 'n-a',
          type: 'references',
          toLocator: { contentHash: await hash('alpha beta gamma\n'), selector: { type: 'text-quote', exact: 'beta' } },
          actor: 'actor:agent:noe',
          when: '2026-09-16T12:00:00Z',
          validFrom: '2026-09-16T12:00:00Z',
          weight: 0.8,
        },
      ],
    }
    const first = await emitKoineTree(input)
    const parsed = parseKoineTree(first)
    expect(parsed.edges[0]?.toLocator?.selector).toEqual({ type: 'text-quote', exact: 'beta' })
    expect(parsed.edges[0]?.weight).toBe(0.8)
    expect(parsed.edges[0]?.actor).toBe('actor:agent:noe')

    const second = await emitKoineTree({
      nodes: parsed.nodes.map((n) => ({
        id: n.id,
        path: n.path,
        format: n.format,
        bytes: parsed.bodies.get(n.path) as string,
      })),
      edges: [...parsed.edges],
    })
    expect(second.get('.koine/edges.jsonl')).toBe(first.get('.koine/edges.jsonl') as string)
  })

  it('refuses at emit a Locator that does not match the body it addresses', async () => {
    await expect(
      emitKoineTree({
        nodes: [
          { id: 'n-a', path: 'a.md', format: 'markdown', bytes: 'alpha\n' },
          { id: 'n-b', path: 'b.md', format: 'markdown', bytes: 'claim\n' },
        ],
        edges: [
          {
            from: 'n-b',
            to: 'n-a',
            type: 'references',
            toLocator: { contentHash: await hash('something else\n') },
          },
        ],
      }),
    ).rejects.toThrow(/the pointer ships already rotten/)
  })

  it('reports `stale` rather than a region when the body has moved', async () => {
    const was = await hash('alpha beta gamma\n')
    const now = await hash('alpha BETA gamma\n')
    expect(
      await resolveLocator({ contentHash: was, selector: { type: 'text-quote', exact: 'beta' } }, 'alpha BETA gamma\n'),
    ).toEqual({ status: 'stale', expected: was, actual: now })
  })

  it('resolves each of the six selector types, and is honest about the two it cannot decode', async () => {
    const text = 'one\ntwo\nthree\n'
    const h = await hash(text)
    const at = (selector: Parameters<typeof resolveLocator>[0]['selector']) =>
      resolveLocator({ contentHash: h, selector }, text)

    expect(await at({ type: 'text-quote', exact: 'two' })).toMatchObject({ status: 'resolved' })
    expect(await at({ type: 'text-position', start: 4, end: 7 })).toMatchObject({
      status: 'resolved',
      region: { text: 'two' },
    })
    expect(await at({ type: 'line-range', start: 2 })).toMatchObject({ status: 'resolved', region: { text: 'two' } })
    expect(await at({ type: 'line-range', start: 2, end: 3 })).toMatchObject({ region: { text: 'two\nthree' } })
    expect(await at({ type: 'page', number: 3 })).toMatchObject({ status: 'opaque' })
    expect(await at({ type: 'time-range', start: 12.5 })).toMatchObject({ status: 'opaque' })

    const json = '{"rows":[{"amount":7}]}'
    const jh = await hash(json)
    expect(
      await resolveLocator({ contentHash: jh, selector: { type: 'json-pointer', pointer: '/rows/0/amount' } }, json),
    ).toEqual({ status: 'resolved', region: { kind: 'value', value: 7 } })
  })

  it('will not disambiguate a quote it cannot disambiguate', async () => {
    const text = 'beta and beta\n'
    const h = await hash(text)
    expect(await resolveLocator({ contentHash: h, selector: { type: 'text-quote', exact: 'beta' } }, text)).toMatchObject({
      status: 'not-found',
    })
    expect(
      await resolveLocator(
        { contentHash: h, selector: { type: 'text-quote', exact: 'beta', prefix: 'and ' } },
        text,
      ),
    ).toMatchObject({ status: 'resolved', region: { start: 9 } })
  })

  it('refuses a selector outside the closed vocabulary', async () => {
    const files = await emitKoineTree({
      nodes: [
        { id: 'n-a', path: 'a.md', format: 'markdown', bytes: 'x\n' },
        { id: 'n-b', path: 'b.md', format: 'markdown', bytes: 'y\n' },
      ],
      edges: [{ from: 'n-b', to: 'n-a', type: 'references' }],
    })
    const edges = files.get('.koine/edges.jsonl') as string
    const forged = edges.replace(
      '"type":"references"',
      `"type":"references","toLocator":{"contentHash":"${await hash('x\n')}","selector":{"type":"xpath","path":"//p[1]"}}`,
    )
    expect(() => parseKoineTree(new Map(files).set('.koine/edges.jsonl', forged))).toThrow(
      /unknown selector type "xpath" — the vocabulary is closed/,
    )
  })

  it('convicts at verify a Locator whose version the tree no longer holds', async () => {
    const files = await emitKoineTree({
      nodes: [
        { id: 'n-a', path: 'a.md', format: 'markdown', bytes: 'alpha\n' },
        { id: 'n-b', path: 'b.md', format: 'markdown', bytes: 'claim\n' },
      ],
      edges: [{ from: 'n-b', to: 'n-a', type: 'references', toLocator: { contentHash: await hash('alpha\n') } }],
    })
    // The body is replaced and the identity map re-stamped — integrity is
    // intact, and the pointer now names a version nobody holds. Without the
    // hash inside the Locator, this is the failure that is silent.
    const moved = new Map(files)
    moved.set('a.md', 'alpha, amended\n')
    moved.set(
      '.koine/nodes.jsonl',
      (files.get('.koine/nodes.jsonl') as string).replace(await hash('alpha\n'), await hash('alpha, amended\n')),
    )
    const verdict = await verifyKoineTree(moved)
    expect(verdict.integrity.status).toBe('pass')
    expect(verdict.references.status).toBe('fail')
    expect(verdict.references.problems[0]).toContain('a version this tree does not hold')
  })
})

describe('the dictionary’s weight has an instance carrier', () => {
  it('declares the semantics and carries the number — both arms, one crossing', async () => {
    const parsed = parseKoineTree(
      await emitKoineTree({
        nodes: [
          { id: 'n-a', path: 'a.md', format: 'markdown', bytes: 'x\n' },
          { id: 'n-b', path: 'b.md', format: 'markdown', bytes: 'y\n' },
        ],
        edges: [{ from: 'n-b', to: 'n-a', type: 'supports', weight: 0.42 }],
        types: {
          edges: [
            { name: 'supports', description: 'evidence for', directed: true, transitive: false, weight: 'confidence' },
          ],
        },
      }),
    )
    expect(parsed.dictionaries.edges?.[0]?.weight).toBe('confidence')
    expect(parsed.edges[0]?.weight).toBe(0.42)
  })
})

describe('emit refuses what it cannot express', () => {
  it('still rejects a dangling edge outside a slice', async () => {
    await expect(
      emitKoineTree({
        nodes: [{ id: 'n-a', path: 'a.md', format: 'markdown', bytes: 'x\n' }],
        edges: [{ from: 'n-a', to: 'n-gone', type: 'references' }],
      }),
    ).rejects.toThrow(KoineEmitError)
  })
})
