/**
 * The conformance suite — five compositions, not five units.
 *
 * These are the acceptance criteria an unaffiliated project wrote when it
 * assessed koine on 2026-09-16 for a real pilot, translated from its words into
 * executable fixtures. They are a better test plan than this package's own was,
 * for one reason: **they test COMPOSITIONS.** The suite that ran green while
 * every defect of that assessment sat in the source tested each law alone — the
 * roundtrip test re-emitted the original input rather than what it had parsed,
 * so the only path a foreign consumer ever walks was never walked here.
 *
 * **What these are, precisely — corrected 2026-09-17 at the reviewer's request,
 * and the correction is the point.** They are UPSTREAM tests, written here,
 * against this codec, by its editors, on the basis of a prospective consumer's
 * published criteria. They are **not a passed acceptance** — nobody has accepted
 * anything — and they are **not a second independent implementation**. Borrowing
 * a reviewer's criteria does not borrow their independence.
 *
 * Their value is real and smaller than the first sentence here used to claim:
 * the criteria are EXTERNAL, so they test compositions rather than the shapes
 * their author already had in mind. Two further review rounds found twelve more
 * defects while these tests were green, which measures exactly how much they
 * prove. The declared negative population lives in `negative-vectors.test.ts`;
 * that is the half a second implementation can check itself against.
 *
 * | criterion | what it demands |
 * |---|---|
 * | lossless export and import | ids, revisions, units, unknown values, **all four status dimensions** and original evidence references survive |
 * | historical resolution | an old run still points exactly at its old revision after an update; a missing old reference is DETECTED |
 * | traceable answers | queries for affected articles, observed steps and contradicted statements return the declared evidence paths |
 * | release and retraction | internal/unchecked content does not reach the public output; a withdrawal reaches the answer context too |
 * | transport and restore | two separate receivers check identical bytes; a damaged or missing required piece of evidence prevents activation; the previous permitted state stays usable |
 */

import { describe, expect, it } from 'bun:test'
import { emitKoineTree, parseKoineTree, verifyKoineTree } from '../src/tree.js'
import { resolveLocator } from '../src/locator.js'
import { receiveProposal } from '../src/proposal.js'
import { checkCapabilities } from '../src/capabilities.js'
import { sha256Hex } from '../src/sha256.js'
import type { KoineContentHash, KoineTreeInput } from '../src/types.js'

const hash = async (b: string): Promise<KoineContentHash> => `sha256:${await sha256Hex(b)}`

const ARTICLE = [
  '# Wall moisture, output rule',
  '',
  'The measured value is reported in percent by mass. Values above 4.0 block release.',
  '',
  '```shape',
  'kind: rule',
  'unit: percent-by-mass',
  'threshold: 4.0',
  'revision: 7',
  'state: valid',
  '```',
].join('\n')

const DRAFT_NOTE = [
  '# Half-formed objection',
  '',
  'Somebody said 4.0 might be too strict in winter. Nobody has checked.',
  '',
  '```shape',
  'kind: rule',
  'unit: percent-by-mass',
  'threshold: 3.0',
  'revision: 1',
  'state: draft',
  '```',
].join('\n')

const RUN = JSON.stringify({ ran: '2026-08-01T00:00:00Z', observed: 5.2, verdict: 'blocked' })

const TYPES = {
  records: [
    {
      name: 'rule',
      schema: {
        type: 'object',
        properties: {
          kind: { const: 'rule' },
          unit: { type: 'string' },
          threshold: { type: 'number' },
          revision: { type: 'integer' },
          state: { enum: ['spoken', 'draft', 'valid', 'frozen'] },
          // A value this version has never heard of, carried under the vendor
          // extension rule — the assessment's "unknown values survive".
          'x-atlas-confidence': { type: 'string' },
        },
        required: ['kind', 'revision'],
      },
    },
  ],
  edges: [
    { name: 'observes', description: 'a run observed this rule', directed: true, transitive: false, weight: 'none' },
    { name: 'contradicts', description: 'says the opposite', directed: true, transitive: false, weight: 'confidence' },
  ],
}

async function corpus(): Promise<KoineTreeInput> {
  return {
    nodes: [
      { id: 'n-rule', path: 'articles/wall-moisture.md', format: 'markdown', bytes: ARTICLE },
      { id: 'n-objection', path: 'notes/objection.md', format: 'markdown', bytes: DRAFT_NOTE },
      { id: 'n-run', path: 'observations/run-0001.json', format: 'json', bytes: RUN },
      {
        // Evidence that is referenced and NOT carried — the assessment's
        // ~138 MB of source blobs, honestly declared instead of silently absent.
        id: 'n-scan',
        path: 'evidence/scan-2026-08-01.pdf',
        format: 'pdf',
        contentHash: await hash('a very large scan\n'),
        absent: { reason: 'oversize', required: true },
      },
    ],
    edges: [
      {
        from: 'n-run',
        to: 'n-rule',
        type: 'observes',
        // The run points at the exact passage AND the exact revision it read.
        toLocator: {
          contentHash: await hash(ARTICLE),
          selector: { type: 'text-quote', exact: 'Values above 4.0 block release.' },
        },
        actor: 'actor:agent:pilot',
        when: '2026-08-01T00:00:00Z',
        validFrom: '2026-08-01T00:00:00Z',
      },
      {
        from: 'n-objection',
        to: 'n-rule',
        type: 'contradicts',
        toLocator: { contentHash: await hash(ARTICLE) },
        actor: 'actor:user:inspector',
        when: '2026-08-02T00:00:00Z',
        weight: 0.4,
      },
    ],
    commits: [
      { seq: 1, actor: 'actor:user:owner', what: 'set the threshold at 4.0', why: 'pilot', when: '2026-07-01T00:00:00Z', node: 'n-rule' },
      { seq: 2, actor: 'actor:agent:pilot', what: 'recorded a blocked run', why: 'pilot', when: '2026-08-01T00:00:00Z', node: 'n-run' },
      { seq: 3, actor: 'actor:user:inspector', what: 'raised an objection', why: 'pilot', when: '2026-08-02T00:00:00Z', node: 'n-objection' },
    ],
    types: TYPES,
    requires: ['absent-body', 'locator'],
  }
}

describe('C1 — lossless export and import', () => {
  it('keeps ids, revisions, units, unknown values, all four status dimensions and evidence references', async () => {
    const first = await emitKoineTree(await corpus())
    const parsed = parseKoineTree(first)

    // Re-emit from what was PARSED — the path a foreign consumer actually walks,
    // and the one the old suite never ran.
    const second = await emitKoineTree({
      nodes: parsed.nodes.map((n) =>
        n.absent !== undefined
          ? { id: n.id, path: n.path, format: n.format, contentHash: n.contentHash, absent: n.absent }
          : { id: n.id, path: n.path, format: n.format, bytes: parsed.bodies.get(n.path) as string },
      ),
      edges: [...parsed.edges],
      commits: [...parsed.commits],
      types: parsed.dictionaries,
      requires: [...parsed.requires],
    })

    expect([...second.keys()].sort()).toEqual([...first.keys()].sort())
    for (const [path, bytes] of first) expect([path, second.get(path)]).toEqual([path, bytes])

    // …and each demanded dimension, named rather than implied by the byte compare.
    const again = parseKoineTree(second)
    expect(again.nodes.map((n) => n.id)).toEqual(['n-rule', 'n-objection', 'n-run', 'n-scan'])
    expect(again.nodes.map((n) => n.state)).toEqual(['valid', 'draft', undefined, undefined])
    expect(again.nodes.find((n) => n.id === 'n-scan')?.absent).toEqual({ reason: 'oversize', required: true })
    expect(again.edges[0]?.toLocator?.selector).toEqual({
      type: 'text-quote',
      exact: 'Values above 4.0 block release.',
    })
    expect(again.edges[1]?.weight).toBe(0.4)
    expect(again.dictionaries.records?.[0]?.schema['properties']).toMatchObject({
      'x-atlas-confidence': { type: 'string' },
    })
  })
})

describe('C2 — historical resolution', () => {
  it('still points exactly at the revision it read, and DETECTS that the revision has moved', async () => {
    const updated = ARTICLE.replace('threshold: 4.0', 'threshold: 3.5').replace('above 4.0', 'above 3.5')
    const input = await corpus()
    const files = await emitKoineTree({
      ...input,
      nodes: input.nodes.map((n) => (n.id === 'n-rule' ? { ...n, bytes: updated } : n)),
      // The run's Locator still names the OLD revision: that is the point.
      edges: input.edges?.map((e) => e),
    }).catch((error: Error) => error)

    // Emit refuses outright, because a pointer that is broken when it is written
    // should not be discovered by whoever tries to follow it.
    expect(files).toBeInstanceOf(Error)
    expect((files as Error).message).toContain('already rotten')

    // A tree that arrives that way from elsewhere is convicted at verify, and
    // the verdict names the version the reader does not hold.
    const fromElsewhere = await emitKoineTree(await corpus())
    const moved = new Map(fromElsewhere)
    moved.set('articles/wall-moisture.md', updated)
    moved.set(
      '.koine/nodes.jsonl',
      (fromElsewhere.get('.koine/nodes.jsonl') as string).replace(await hash(ARTICLE), await hash(updated)),
    )
    const verdict = await verifyKoineTree(moved)
    expect(verdict.integrity.status).toBe('pass')
    expect(verdict.references.status).toBe('fail')
    expect(verdict.references.problems.join(' ')).toContain('a version this tree does not hold')

    // And the old reference still resolves against the old bytes — exact, not
    // approximate. "Historical resolution" is this sentence.
    const old = await hash(ARTICLE)
    expect(
      resolveLocator(
        { contentHash: old, selector: { type: 'text-quote', exact: 'Values above 4.0 block release.' } },
        ARTICLE,
        old,
      ),
    ).toMatchObject({ status: 'resolved' })
  })
})

describe('C3 — traceable answers', () => {
  it('returns the declared evidence path for each of the three questions', async () => {
    const tree = parseKoineTree(await emitKoineTree(await corpus()))

    // "which articles does this run affect" — an edge, not a guess.
    const observed = tree.edges.filter((e) => e.type === 'observes')
    expect(observed.map((e) => [e.from, e.to])).toEqual([['n-run', 'n-rule']])

    // "which runtime steps observed it" — with WHO and WHEN, which is what makes
    // the edge an assertion rather than a link.
    expect(observed[0]?.actor).toBe('actor:agent:pilot')
    expect(observed[0]?.when).toBe('2026-08-01T00:00:00Z')

    // "which statements are contradicted" — and the passage each points at.
    const contradicted = tree.edges.filter((e) => e.type === 'contradicts')
    expect(contradicted).toHaveLength(1)
    const body = tree.bodies.get('articles/wall-moisture.md') as string
    const where = resolveLocator(
      observed[0]?.toLocator as NonNullable<(typeof observed)[0]['toLocator']>,
      body,
      await hash(body),
    )
    expect(where).toMatchObject({ status: 'resolved', region: { text: 'Values above 4.0 block release.' } })
  })
})

describe('C4 — release and retraction', () => {
  it('keeps unchecked content out of the public output', async () => {
    const slice = parseKoineTree(await emitKoineTree(await corpus(), { frozenSlice: true }))
    // The draft objection does not travel…
    expect(slice.nodes.map((n) => n.id)).not.toContain('n-objection')
    // …and neither does the edge that would have implied it, nor its history.
    expect(slice.edges.map((e) => e.type)).toEqual(['observes'])
    expect(slice.commits.map((c) => c.node)).not.toContain('n-objection')
    expect(JSON.stringify([...slice.commits])).not.toContain('objection')
  })

  it('carries a declared status source, and a reader that cannot honour it refuses', async () => {
    // Retraction reaching the ANSWER context, not only a shelf, is a reader
    // rule (§7.3) — and it only binds because a package can DEMAND it.
    expect(checkCapabilities(['status-source'], ['absent-body', 'locator'])).toEqual({
      honoured: false,
      missing: ['status-source'],
    })
  })
})

describe('C5 — transport and restore', () => {
  it('two separate receivers check identical bytes', async () => {
    const shipped = await emitKoineTree(await corpus())
    // Two independent parses of the same bytes agree completely — the property a
    // second implementation needs, and the reason emission is canonical (§1.4).
    const a = parseKoineTree(shipped)
    const b = parseKoineTree(new Map(shipped))
    expect(JSON.stringify(a.nodes)).toBe(JSON.stringify(b.nodes))
    expect(JSON.stringify(a.edges)).toBe(JSON.stringify(b.edges))
    expect(JSON.stringify(a.commits)).toBe(JSON.stringify(b.commits))
    expect((await verifyKoineTree(shipped)).ok).toBe(true)
  })

  it('a damaged body prevents activation, and names what was damaged', async () => {
    const shipped = await emitKoineTree(await corpus())
    const damaged = new Map(shipped).set('observations/run-0001.json', '{"ran":"tampered"}')
    const verdict = await verifyKoineTree(damaged)
    expect(verdict.integrity.status).toBe('fail')
    expect(verdict.integrity.problems.join(' ')).toContain('observations/run-0001.json')
  })

  it('a REQUIRED but absent piece of evidence is declared, so activation can refuse on it', async () => {
    const tree = parseKoineTree(await emitKoineTree(await corpus()))
    const scan = tree.nodes.find((n) => n.id === 'n-scan')
    expect(scan?.absent?.required).toBe(true)
    // The tree still verifies — incomplete is not invalid — and the digest of
    // the missing body travels, so a receiver that fetches it can check it.
    expect((await verifyKoineTree(await emitKoineTree(await corpus()))).integrity.status).toBe('pass')
    expect(scan?.contentHash).toBe(await hash('a very large scan\n'))
  })

  it('the previous permitted state stays usable — a proposal against a moved base is returned, not applied', async () => {
    const files = await emitKoineTree(await corpus())
    const tree = parseKoineTree(files)
    const receipt = receiveProposal(
      {
        format: 'koine/proposal@v0',
        target: {
          nodeId: 'n-rule',
          path: 'articles/wall-moisture.md',
          baseContentHash: await hash('some older revision\n'),
        },
        baseChainHead: tree.chain?.links.at(-1)?.hash,
        schema: 'koine/types/rule@v0',
        proposer: 'actor:user:inspector',
        when: '2026-09-17T00:00:00Z',
        rationale: 'winter',
        changes: [{ field: 'threshold', from: 4.0, to: 3.0 }],
        resultingShape: { kind: 'rule', unit: 'percent-by-mass', threshold: 3.0, revision: 7, state: 'valid' },
      },
      tree,
      files,
    )
    expect(receipt.status).toBe('stale')
    // …and nothing was written: the held revision is still the held revision.
    expect(parseKoineTree(files).nodes.find((n) => n.id === 'n-rule')?.contentHash).toBe(await hash(ARTICLE))
  })
})
