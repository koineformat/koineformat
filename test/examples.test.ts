/**
 * The example repo, read off the disk it ships on.
 *
 * `examples/own-docs/` is a real koine repo — floors 0–2, a real identity map,
 * a real Merkle chain — and its sidecars were emitted by a *different*
 * implementation: the workspace's Python generator, whose reference verifier
 * (`tools/verify.py`) is what the README tells a reader to run. So this suite
 * is the only conformance test in the family that crosses implementations on
 * real bytes: it parses that tree, verifies it, re-emits it from what it parsed,
 * and compares byte for byte against the committed files.
 *
 * Two independent implementations, one normative algorithm. A divergence here
 * is a divergence in the format, not in a fixture.
 */
import { describe, expect, it } from 'bun:test'
import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join, relative } from 'node:path'
import { emitKoineTree, parseKoineTree, verifyKoineTree } from '../src/tree.js'
import { emitRecordTypeJson, parseRecordTypeJson } from '../src/dictionaries.js'

const ROOT = fileURLToPath(new URL('../examples/own-docs', import.meta.url))

/**
 * The one file in the tree that a byte-compare may not claim.
 *
 * It is hand-authored JSON Schema, not emitter output — the Python generator
 * writes `nodes.jsonl`, `edges.jsonl` and `chain.jsonl` and nothing under
 * `types/`. Two author's-hand differences survive into the file: `$schema`
 * stands before `$id` (the emitter stamps `$id` first and spreads the schema
 * after it), and its nested objects are written on single lines (the emitter
 * pretty-prints everything at two spaces). Neither touches content — the
 * assertion below is that the schema round-trips *equal*, which is the claim
 * the form actually makes about a carried-verbatim Record type.
 *
 * Re-emitting the file to close this gap would be the wrong repair: the example
 * exists to be read by a human in five minutes, and a machine-expanded schema
 * reads worse. Should it ever be regenerated, this exception goes with it.
 */
const AUTHORED_NOT_EMITTED = '.koine/types/metric-definition.schema.json'

async function readTree(dir: string, into = new Map<string, Uint8Array>()): Promise<Map<string, Uint8Array>> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) await readTree(full, into)
    else into.set(relative(ROOT, full), new Uint8Array(await readFile(full)))
  }
  return into
}

const decoder = new TextDecoder()
const text = (value: Uint8Array | string): string => (typeof value === 'string' ? value : decoder.decode(value))

describe('examples/own-docs — the codec against a tree it did not write', () => {
  it('verifies every content hash and the whole chain', async () => {
    expect(await verifyKoineTree(await readTree(ROOT))).toEqual({ ok: true, problems: [] })
  })

  it('convicts the tree when one body byte moves', async () => {
    const files = await readTree(ROOT)
    const readme = text(files.get('README.md') as Uint8Array)
    const verdict = await verifyKoineTree(new Map(files).set('README.md', `${readme} ` as unknown as Uint8Array))
    expect(verdict.ok).toBe(false)
    expect(verdict.problems.some((p) => p.includes('README.md'))).toBe(true)
  })

  it('reads the identity map, the graph slice and the memory as declared', async () => {
    const parsed = parseKoineTree(await readTree(ROOT))
    expect(parsed.nodes.map((n) => n.path)).toEqual([
      'README.md',
      'definitions/koine-repo.md',
      'definitions/active-member.md',
      'data/decision.entries.jsonl',
    ])
    expect(parsed.edges).toHaveLength(2)
    expect(parsed.commits).toHaveLength(3)
    expect(parsed.chain?.header.format).toBe('koine/chain@v0')
    expect(parsed.chain?.links.at(-1)?.hash).toBe(
      '07b5f4210f3660dd9ae086ad9111114123408ce8f85a98ad21a386be45dbc66d',
    )
  })

  it('hands a standalone reader a typed grammar, not raw JSON', async () => {
    const { dictionaries } = parseKoineTree(await readTree(ROOT))
    expect(dictionaries.tags?.map((t) => t.name)).toEqual(['definition'])
    expect(dictionaries.tags?.[0]?.cascade).toBe('cold')
    expect(dictionaries.edges?.map((e) => e.name)).toEqual(['references'])
    expect(dictionaries.edges?.[0]?.directed).toBe(true)
    expect(dictionaries.records?.map((r) => r.name)).toEqual(['metric-definition'])
  })

  it('re-emits the committed bytes exactly — bodies, identity map, graph slice, memory', async () => {
    const onDisk = await readTree(ROOT)
    const parsed = parseKoineTree(onDisk)

    const reEmitted = await emitKoineTree({
      nodes: parsed.nodes.map((node) => ({
        id: node.id,
        path: node.path,
        format: node.format,
        bytes: parsed.bodies.get(node.path) as Uint8Array,
      })),
      edges: [...parsed.edges],
      commits: [...parsed.commits],
      types: parsed.dictionaries,
    })

    expect([...reEmitted.keys()].sort()).toEqual([...onDisk.keys()].sort())
    for (const [path, committed] of onDisk) {
      if (path === AUTHORED_NOT_EMITTED) continue
      expect(text(reEmitted.get(path) as Uint8Array | string)).toBe(text(committed))
    }
  })

  it('round-trips the hand-authored schema equal, where it cannot round-trip byte-identical', async () => {
    const onDisk = await readTree(ROOT)
    const committed = JSON.parse(text(onDisk.get(AUTHORED_NOT_EMITTED) as Uint8Array)) as Record<string, unknown>
    const reEmitted = JSON.parse(
      emitRecordTypeJson(parseRecordTypeJson('metric-definition', committed)),
    ) as Record<string, unknown>

    expect(reEmitted).toEqual(committed)
    // The whole of the difference, named rather than tolerated: where `$id` sits.
    expect(Object.keys(committed)[0]).toBe('$schema')
    expect(Object.keys(reEmitted)[0]).toBe('$id')
  })
})
