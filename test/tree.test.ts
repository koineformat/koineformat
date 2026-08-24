import { describe, expect, it } from 'bun:test'
import { emitKoineTree, parseKoineTree, verifyKoineTree } from '../src/tree.js'
import { KoineEmitError, type KoineTreeInput } from '../src/types.js'
import { sha256Hex } from '../src/sha256.js'

const input: KoineTreeInput = {
  nodes: [
    {
      id: 'a'.repeat(24),
      path: 'definitions/active-member.md',
      format: 'markdown',
      bytes: '# Active Member\n\n```shape\nkind: metric-definition\nstate: valid\n```\n',
      state: 'valid',
    },
    {
      id: 'b'.repeat(24),
      path: 'notes/draft-idea.md',
      format: 'markdown',
      bytes: '# Draft idea\n',
      state: 'draft',
    },
  ],
  edges: [{ from: 'b'.repeat(24), to: 'a'.repeat(24), type: 'references' }],
  commits: [
    { seq: 1, actor: 'actor:user:owner1', what: 'found the room', why: 'fixture', when: '2026-07-31T00:00:00Z' },
    { seq: 2, actor: 'actor:agent:helper', what: 'add the draft', why: 'fixture', when: '2026-07-31T00:01:00Z' },
  ],
  types: {
    records: [{ name: 'metric-definition', schema: { title: 'metric-definition', type: 'object' } }],
    tags: [{ name: 'definition', description: 'declares what something IS', cascade: 'cold', proactivity: 'retrieve', contentFormat: 'text' }],
    edges: [{ name: 'references', description: 'cites or builds on', directed: true, transitive: false, weight: 'none' }],
  },
}

describe('emitKoineTree / parseKoineTree', () => {
  it('emits bodies verbatim plus all sidecars, and parse → re-emit is byte-identical', async () => {
    const files = await emitKoineTree(input)

    expect(files.get('definitions/active-member.md')).toBe(input.nodes[0]!.bytes)
    expect([...files.keys()].filter((p) => p.startsWith('.koine/'))).toEqual(
      expect.arrayContaining([
        '.koine/nodes.jsonl',
        '.koine/edges.jsonl',
        '.koine/history/commits.jsonl',
        '.koine/history/chain.jsonl',
        '.koine/types/metric-definition.schema.json',
        '.koine/types/definition.tagtype.json',
        '.koine/types/references.edgetype.json',
      ]),
    )

    const parsed = parseKoineTree(files)
    expect(parsed.nodes.map((n) => n.path)).toEqual(['definitions/active-member.md', 'notes/draft-idea.md'])
    expect(parsed.commits).toEqual(input.commits)
    expect(parsed.chain?.links).toHaveLength(2)
    expect(parsed.bodies.size).toBe(2)

    const reEmitted = await emitKoineTree({
      nodes: input.nodes,
      edges: [...parsed.edges],
      commits: [...parsed.commits],
      types: input.types,
    })
    for (const [path, content] of files) {
      expect(reEmitted.get(path)).toEqual(content)
    }
  })

  it('verifyKoineTree passes the emitted tree and convicts a flipped body byte', async () => {
    const files = await emitKoineTree(input)
    expect((await verifyKoineTree(files)).ok).toBe(true)

    const tampered = new Map(files)
    tampered.set('notes/draft-idea.md', '# Draft idea!\n')
    const verdict = await verifyKoineTree(tampered)
    expect(verdict.ok).toBe(false)
    expect(verdict.problems.some((p) => p.includes('notes/draft-idea.md'))).toBe(true)
  })

  it('applies the travel law: a frozen slice carries only valid/frozen, edges filtered', async () => {
    const slice = await emitKoineTree(input, { frozenSlice: true })
    const parsed = parseKoineTree(slice)
    expect(parsed.nodes.map((n) => n.path)).toEqual(['definitions/active-member.md'])
    expect(parsed.edges).toEqual([])
    expect(slice.has('notes/draft-idea.md')).toBe(false)
  })

  it('treats a stateless node as spoken — it never enters a frozen slice', async () => {
    const slice = await emitKoineTree(
      { nodes: [{ id: 'c'.repeat(24), path: 'loose.md', format: 'markdown', bytes: 'x\n' }] },
      { frozenSlice: true },
    )
    expect(parseKoineTree(slice).nodes).toEqual([])
  })

  it('rejects reserved paths, duplicate ids, and dangling edges outside a slice', async () => {
    await expect(
      emitKoineTree({ nodes: [{ id: 'd'.repeat(24), path: '.koine/evil.md', format: 'markdown', bytes: 'x' }] }),
    ).rejects.toThrow(KoineEmitError)

    await expect(
      emitKoineTree({
        nodes: [
          { id: 'e'.repeat(24), path: 'one.md', format: 'markdown', bytes: 'x' },
          { id: 'e'.repeat(24), path: 'two.md', format: 'markdown', bytes: 'y' },
        ],
      }),
    ).rejects.toThrow(/duplicate node id/)

    await expect(
      emitKoineTree({
        nodes: [{ id: 'f'.repeat(24), path: 'one.md', format: 'markdown', bytes: 'x' }],
        edges: [{ from: 'f'.repeat(24), to: 'g'.repeat(24), type: 'references' }],
      }),
    ).rejects.toThrow(/references a node not in the tree/)
  })
})

/**
 * The envelope's reach — what a package verifier needs from the tree, and nothing more.
 *
 * The standing question this answers: an envelope that carried per-file hashes of
 * its own (the v0 envelope's per-file `contents[]`) was defended as necessary so that
 * `pin verify` could work WITHOUT implementing koine. That defence conflated
 * *reading the identity map* (four fields of JSONL, which IS integrity data) with
 * *implementing koine* (the dictionaries and edges beside it in floor 1, plus the
 * whole memory floor — what a packaging implementer genuinely never touches).
 *
 * Floor numbering is the SPEC's throughout (§1.1: floor 0 the tree · floor 1 the
 * grammar, which CONTAINS `nodes.jsonl` · floor 2 the memory). The seam this
 * suite proves runs *inside* floor 1 — the SPEC names it in §3.1 (the identity
 * map vs the dictionaries and edges). Never renumber the floors to express it.
 *
 * This suite is the falsifier, run rather than argued: a verifier reading ONLY
 * `.koine/nodes.jsonl` plus ONE root hash convicts every tamper class. Per-file
 * hashes in the envelope are therefore redundant, and the two survivors have
 * disjoint jobs — the root says *that* the archive changed, the identity map says
 * *which file* and carries the `id`/`format` a root hash cannot express.
 */
describe('the envelope reach — a verifier that knows only the identity map', () => {
  const enc = new TextEncoder()
  const bytesOf = (v: Uint8Array | string) => (typeof v === 'string' ? enc.encode(v) : v)

  /** The envelope's ONE number: sha256 over the canonical `path sha256` listing of every file. */
  const rootHash = async (files: ReadonlyMap<string, Uint8Array | string>): Promise<string> => {
    const rows: string[] = []
    for (const path of [...files.keys()].sort()) {
      rows.push(`${path} ${await sha256Hex(bytesOf(files.get(path)!))}`)
    }
    return sha256Hex(enc.encode(`${rows.join('\n')}\n`))
  }

  /**
   * The minimal verifier. Knows: JSONL, sha256, and that a nodes.jsonl row has
   * `{path, contentHash}`. Knows NOTHING of types, edges, the chain, or the
   * validity gradient — what a packaging implementer never reads.
   */
  const pinVerify = async (
    files: ReadonlyMap<string, Uint8Array | string>,
    envelope: { readonly rootHash: string },
  ): Promise<readonly string[]> => {
    const problems: string[] = []
    if ((await rootHash(files)) !== envelope.rootHash) problems.push('root: archive altered')
    const nodes = files.get('.koine/nodes.jsonl')
    if (nodes === undefined) return [...problems, 'no identity map']
    for (const line of new TextDecoder().decode(bytesOf(nodes)).split('\n').filter(Boolean)) {
      const row = JSON.parse(line) as { path: string; contentHash: string }
      const body = files.get(row.path)
      if (body === undefined) {
        problems.push(`missing: ${row.path}`)
        continue
      }
      if (`sha256:${await sha256Hex(bytesOf(body))}` !== row.contentHash) problems.push(`altered: ${row.path}`)
    }
    return problems
  }

  const withFile = (m: ReadonlyMap<string, Uint8Array | string>, path: string, body: string) =>
    new Map(m).set(path, body)

  it('passes a sealed archive with an envelope of exactly one integrity field', async () => {
    const sealed = await emitKoineTree(input)
    expect(await pinVerify(sealed, { rootHash: await rootHash(sealed) })).toEqual([])
  })

  it('convicts a changed body — and names the file, which a root hash alone cannot', async () => {
    const sealed = await emitKoineTree(input)
    const envelope = { rootHash: await rootHash(sealed) }
    const problems = await pinVerify(withFile(sealed, 'notes/draft-idea.md', '# Draft idea!\n'), envelope)
    expect(problems).toContain('root: archive altered')
    expect(problems).toContain('altered: notes/draft-idea.md')
  })

  it('convicts a tampered grammar or memory sidecar without understanding either', async () => {
    const sealed = await emitKoineTree(input)
    const envelope = { rootHash: await rootHash(sealed) }

    // Floor 1's dictionaries — the verifier cannot read a tag type and does not need to.
    expect(await pinVerify(withFile(sealed, '.koine/types/definition.tagtype.json', '{"name":"x"}'), envelope)).toContain(
      'root: archive altered',
    )
    // Floor 2, the memory — likewise the chain: no chain arithmetic happens here.
    expect(await pinVerify(withFile(sealed, '.koine/history/commits.jsonl', '{"seq":1}\n'), envelope)).toContain(
      'root: archive altered',
    )
  })

  it('convicts a removed file and a rewritten identity map', async () => {
    const sealed = await emitKoineTree(input)
    const envelope = { rootHash: await rootHash(sealed) }

    const dropped = new Map(sealed)
    dropped.delete('notes/draft-idea.md')
    expect(await pinVerify(dropped, envelope)).toEqual(
      expect.arrayContaining(['root: archive altered', 'missing: notes/draft-idea.md']),
    )

    const forged = withFile(sealed, '.koine/nodes.jsonl', '{"id":"z","path":"ghost.md","format":"markdown","contentHash":"sha256:00"}\n')
    expect(await pinVerify(forged, envelope)).toEqual(
      expect.arrayContaining(['root: archive altered', 'missing: ghost.md']),
    )
  })
})

// ---------------------------------------------------------------------------
// The Kind's payload shape — SPEC §2.2 binds a body's `kind:` to
// `types/<kind>.schema.json`, so a Kind that declares a shape emits BOTH files.
// Without both, a Kind arrives saying how it behaves and never what it holds,
// and the receiving side has nothing to check a body of that Kind against.
// ---------------------------------------------------------------------------

describe('a Kind carries its payload shape', () => {
  const withShape: KoineTreeInput = {
    nodes: [{ id: 'c'.repeat(24), path: 'notes/gap.md', format: 'markdown', bytes: '# A gap\n' }],
    types: {
      tags: [{
        name: 'gap',
        description: 'Something missing that needs attention',
        cascade: 'hot',
        proactivity: 'inject',
        contentFormat: 'markdown',
        shape: { type: 'object', properties: { area: { type: 'string' } } },
      }],
    },
  }

  it('emits the facets and the shape as two files under SPEC §2.2 names', async () => {
    const files = await emitKoineTree(withShape)
    expect(files.has('.koine/types/gap.tagtype.json')).toBe(true)
    expect(files.has('.koine/types/gap.schema.json')).toBe(true)
    expect(JSON.parse(files.get('.koine/types/gap.schema.json') as string)).toEqual({
      $id: 'koine/types/gap@v0',
      type: 'object',
      properties: { area: { type: 'string' } },
    })
  })

  it('docks the shape back onto the Kind on parse — not as a free-standing record type', async () => {
    const parsed = parseKoineTree(await emitKoineTree(withShape))
    expect(parsed.dictionaries.tags).toEqual(withShape.types?.tags)
    expect(parsed.dictionaries.records).toEqual([])
  })

  it('survives emit → parse → re-emit byte-identically', async () => {
    const once = await emitKoineTree(withShape)
    const parsed = parseKoineTree(once)
    const twice = await emitKoineTree({
      nodes: [{ id: 'c'.repeat(24), path: 'notes/gap.md', format: 'markdown', bytes: '# A gap\n' }],
      types: parsed.dictionaries,
    })
    expect(twice.get('.koine/types/gap.tagtype.json')).toBe(once.get('.koine/types/gap.tagtype.json'))
    expect(twice.get('.koine/types/gap.schema.json')).toBe(once.get('.koine/types/gap.schema.json'))
  })

  it('rejects a Kind shape and a Record type claiming the same schema file', async () => {
    await expect(emitKoineTree({
      nodes: [{ id: 'c'.repeat(24), path: 'notes/gap.md', format: 'markdown', bytes: '# A gap\n' }],
      types: {
        records: [{ name: 'gap', schema: { type: 'object' } }],
        tags: withShape.types?.tags ?? [],
      },
    })).rejects.toThrow(KoineEmitError)
  })
})

describe('the typed read side', () => {
  it('returns every dictionary as its declared shape, not as raw JSON', async () => {
    const parsed = parseKoineTree(await emitKoineTree(input))
    expect(parsed.dictionaries.records).toEqual(input.types?.records)
    expect(parsed.dictionaries.tags).toEqual(input.types?.tags)
    expect(parsed.dictionaries.edges).toEqual(input.types?.edges)
  })

  it('keeps the raw map beside it, so an unknown key still re-emits verbatim', async () => {
    const parsed = parseKoineTree(await emitKoineTree(input))
    expect(parsed.types.get('definition.tagtype.json')).toMatchObject({ $id: 'koine/types/definition@v0' })
  })
})

// ---------------------------------------------------------------------------
// Custody and cascade at tree grain — the two optional dictionary facets. The
// dictionary-grain proof is in dictionaries.test.ts; what is proven here is
// that they survive the ONE pair a boundary actually calls.
// ---------------------------------------------------------------------------

describe('custody and cascade travel through the tree', () => {
  const withFacets: KoineTreeInput = {
    nodes: [{ id: 'h'.repeat(24), path: 'notes/installed.md', format: 'markdown', bytes: '# Installed\n' }],
    types: {
      tags: [{
        name: 'finding',
        description: 'Something a connector-installed kind marks',
        cascade: 'hot',
        proactivity: 'inject',
        contentFormat: 'markdown',
        provenance: { plugin: 'research-kit', version: '1.2.0' },
      }],
      edges: [{
        name: 'supports',
        description: 'The source backs the target up',
        cascade: 'cold',
        directed: true,
        transitive: false,
        weight: 'strong',
      }],
    },
  }

  it('puts custody in the Kind file and cascade in the Link-type file', async () => {
    const files = await emitKoineTree(withFacets)
    expect(JSON.parse(files.get('.koine/types/finding.tagtype.json') as string)).toMatchObject({
      provenance: { plugin: 'research-kit', version: '1.2.0' },
    })
    expect(JSON.parse(files.get('.koine/types/supports.edgetype.json') as string)).toMatchObject({
      cascade: 'cold',
    })
  })

  it('reads both back as typed dictionaries and re-emits byte-identically', async () => {
    const once = await emitKoineTree(withFacets)
    const parsed = parseKoineTree(once)
    expect(parsed.dictionaries.tags).toEqual(withFacets.types?.tags)
    expect(parsed.dictionaries.edges).toEqual(withFacets.types?.edges)

    const twice = await emitKoineTree({ nodes: withFacets.nodes, types: parsed.dictionaries })
    for (const [path, content] of once) {
      expect(twice.get(path)).toEqual(content)
    }
  })

  it('leaves a tree that declares neither facet exactly as it was', async () => {
    // `input` carries no provenance and no edge-type cascade — the shape every
    // already-written tree has. Its dictionary bytes must not have moved.
    const files = await emitKoineTree(input)
    expect(files.get('.koine/types/definition.tagtype.json')).toBe(
      '{\n  "$id": "koine/types/definition@v0",\n  "name": "definition",\n'
      + '  "description": "declares what something IS",\n  "cascade": "cold",\n'
      + '  "proactivity": "retrieve",\n  "contentFormat": "text"\n}\n',
    )
    expect(files.get('.koine/types/references.edgetype.json')).toBe(
      '{\n  "$id": "koine/types/references@v0",\n  "name": "references",\n'
      + '  "description": "cites or builds on",\n  "directed": true,\n'
      + '  "transitive": false,\n  "weight": "none"\n}\n',
    )
  })
})
