/**
 * The structural guards — what makes this a standard rather than a library
 * with a document beside it.
 *
 * A standard's failure mode is not a bug; it is **drift between the text and
 * the code**, and drift is never found by the people who wrote both. This
 * repository's first finder was a stranger: an unaffiliated project assessed
 * koine on 2026-09-16 and reported defects that had been in the source for
 * months, green suite and all.
 *
 * Three guards, each over a DECLARED population, because a finder without one is
 * an opinion:
 *
 * 1. every section that states a normative rule is cited by a test;
 * 2. every `§` a docblock or a test cites exists in the specification;
 * 3. the canonical emission is byte-stable, so a change to the bytes cannot
 *    happen without someone deciding to make it.
 */

import { describe, expect, it } from 'bun:test'
import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { emitKoineTree } from '../src/tree.js'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

const spec = await readFile(join(ROOT, 'SPEC.md'), 'utf8')

/** Every heading in SPEC.md, as `<number> <title>`. */
function sections(): { number: string; title: string; body: string }[] {
  const lines = spec.split('\n')
  const out: { number: string; title: string; body: string }[] = []
  let current: { number: string; title: string; body: string[] } | undefined
  for (const line of lines) {
    const heading = /^#{2,4}\s+(?:\*\*)?(\d+(?:\.\d+)*)\.?\s+(.*)$/.exec(line)
    if (heading !== null) {
      if (current !== undefined) out.push({ ...current, body: current.body.join('\n') })
      current = { number: heading[1] as string, title: heading[2] as string, body: [] }
    } else if (/^#{2,4}\s/.test(line)) {
      // An UNnumbered heading — the annex, the declared gaps, the changelog —
      // closes the section above it. Without this the last numbered section
      // swallows the rest of the document and inherits its normative language.
      if (current !== undefined) out.push({ ...current, body: current.body.join('\n') })
      current = undefined
    } else if (current !== undefined) {
      current.body.push(line)
    }
  }
  if (current !== undefined) out.push({ ...current, body: current.body.join('\n') })
  return out
}

async function sourceFiles(dir: string, ext: string[], into: string[] = []): Promise<string[]> {
  for (const entry of await readdir(join(ROOT, dir), { withFileTypes: true })) {
    const rel = join(dir, entry.name)
    if (entry.isDirectory()) await sourceFiles(rel, ext, into)
    else if (ext.some((e) => entry.name.endsWith(e))) into.push(rel)
  }
  return into
}

const ALL = await sourceFiles('src', ['.ts'])
const TESTS = await sourceFiles('test', ['.ts'])

const textOf = async (files: string[]): Promise<string> =>
  (await Promise.all(files.map((f) => readFile(join(ROOT, f), 'utf8')))).join('\n')

const SRC_TEXT = await textOf(ALL)
const TEST_TEXT = await textOf(TESTS)

describe('guard 1 — every section that states a normative rule is cited by a test', () => {
  /**
   * The population: sections containing RFC 2119 normative language. The binding
   * is at SECTION grain, which is weaker than per-statement ids and is what this
   * document can carry today — a retrofit of stable ids across every MUST is the
   * stronger form and is named in the register as the next step. Section grain
   * still fires the moment a NEW normative section lands with nothing testing it,
   * which is the drift that actually happens.
   */
  it('has no normative section that no test mentions', () => {
    const normative = sections().filter((s) => /\b(MUST|MUST NOT|SHALL|SHALL NOT)\b/.test(s.body))
    expect(normative.length).toBeGreaterThan(5) // the population is not empty by accident
    const uncited = normative.filter((s) => !TEST_TEXT.includes(`§${s.number}`))
    expect(uncited.map((s) => `§${s.number} ${s.title}`)).toEqual([])
  })
})

describe('guard 2 — every § a docblock or a test cites actually exists', () => {
  it('cites no section this specification does not have', () => {
    const known = new Set(sections().map((s) => s.number))
    const cited = new Set<string>()
    for (const text of [SRC_TEXT, TEST_TEXT]) {
      for (const match of text.matchAll(/§(\d+(?:\.\d+)*)/g)) cited.add(match[1] as string)
    }
    expect(cited.size).toBeGreaterThan(5)
    // A bare chapter number (`§7`) is legal: chapters are sections too.
    const dangling = [...cited].filter((n) => !known.has(n))
    expect(dangling).toEqual([])
  })

  it('is not vacuous — an invented section number would be caught', () => {
    const known = new Set(sections().map((s) => s.number))
    expect(known.has('99.99')).toBe(false)
  })
})

describe('guard 3 — the canonical emission is byte-stable', () => {
  /**
   * The golden bytes. A change to emission — a key order, a separator, a new
   * always-present field — breaks this test, which is the point: canonical
   * emission is what makes a second implementation possible at all (§1.4), so
   * changing it must be a decision someone takes and writes in the changelog,
   * never a side effect of a refactor.
   */
  const GOLDEN = [
    '{"id":"n-a","path":"a.md","format":"markdown","contentHash":"sha256:'
      + 'ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb"}',
    '{"id":"n-b","path":"b.md","format":"markdown","contentHash":"sha256:'
      + '3e23e8160039594a33894f6564e1b1348bbd7a0088d42c4acb73eeaed59c009d","state":"valid"}',
  ].join('\n')

  it('emits the same identity-map bytes it emitted when this fixture was written', async () => {
    const files = await emitKoineTree({
      nodes: [
        { id: 'n-a', path: 'a.md', format: 'markdown', bytes: 'a' },
        { id: 'n-b', path: 'b.md', format: 'markdown', bytes: 'b', state: 'valid' },
      ],
    })
    expect(files.get('.koine/nodes.jsonl')).toBe(`${GOLDEN}\n`)
  })

  it('emits the same edge and commit bytes', async () => {
    const files = await emitKoineTree({
      nodes: [
        { id: 'n-a', path: 'a.md', format: 'markdown', bytes: 'a' },
        { id: 'n-b', path: 'b.md', format: 'markdown', bytes: 'b' },
      ],
      edges: [{ from: 'n-a', to: 'n-b', type: 'references' }],
      commits: [
        { seq: 1, actor: 'actor:user:u', what: 'w', why: 'y', when: '2026-01-01T00:00:00Z', node: 'n-a' },
      ],
    })
    expect(files.get('.koine/edges.jsonl')).toBe('{"from":"n-a","to":"n-b","type":"references"}\n')
    expect(files.get('.koine/history/commits.jsonl')).toBe(
      '{"seq":1,"actor":"actor:user:u","what":"w","why":"y","when":"2026-01-01T00:00:00Z","node":"n-a"}\n',
    )
  })

  it('leaves a pre-facet line byte-identical — the rule §1.4 rests on', async () => {
    // Every facet added since the founding is omitted when absent, so a tree
    // written before any of them re-emits unchanged. Without this the form
    // could not grow without rewriting history.
    const files = await emitKoineTree({
      nodes: [{ id: 'n-a', path: 'a.md', format: 'markdown', bytes: 'a' }],
      edges: [],
      commits: [{ seq: 1, actor: 'actor:user:u', what: 'w', why: 'y', when: '2026-01-01T00:00:00Z' }],
    })
    expect(files.get('.koine/edges.jsonl')).toBe('')
    expect(files.get('.koine/history/commits.jsonl')).toBe(
      '{"seq":1,"actor":"actor:user:u","what":"w","why":"y","when":"2026-01-01T00:00:00Z"}\n',
    )
    expect(files.get('.koine/nodes.jsonl')).toBe(
      '{"id":"n-a","path":"a.md","format":"markdown","contentHash":"sha256:'
        + 'ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb"}\n',
    )
  })
})

describe('the outward claims — the density rule applies to this repository too', () => {
  it('says nothing about publication that npm contradicts', async () => {
    const readme = await readFile(join(ROOT, 'README.md'), 'utf8')
    const pkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8')) as { version: string }
    // The README carried "not yet published" and "Nothing here is published or
    // founded" while npm served 0.1.2 for three weeks. A stranger found it in
    // an hour; nothing here was looking.
    expect(readme).not.toContain('not yet published')
    expect(readme).not.toContain('Nothing here is published or founded')
    // Whatever version the README names, it is the one this package IS.
    for (const match of readme.matchAll(/koineformat@(\d+\.\d+\.\d+)/g)) {
      expect(match[1]).toBe(pkg.version)
    }
  })
})
