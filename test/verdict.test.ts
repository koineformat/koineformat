/**
 * The crossing — release 2's receipts: *the verdict*.
 *
 * What a receiver LEARNS, and what it may be required to honour. Until this
 * release koine's only extension shape was `x-`, ignorable by construction, so
 * a profile could not say *you must honour this or refuse me* — and a package
 * could not say what it lacks, nor where its own standing is published.
 */

import { describe, expect, it } from 'bun:test'
import { emitKoineTree, parseKoineTree, verifyKoineTree } from '../src/tree.js'
import {
  REGISTERED_CAPABILITIES,
  REQUIRES_PATH,
  checkCapabilities,
  parseRequiresJson,
} from '../src/capabilities.js'
import { validateManifest } from '../src/core/manifest.js'
import { KoineEmitError, KoineParseError, type KoineContentHash } from '../src/types.js'
import { sha256Hex } from '../src/sha256.js'

const hash = async (bytes: string): Promise<KoineContentHash> => `sha256:${await sha256Hex(bytes)}`

const manifest = (extra: Record<string, unknown> = {}) => ({
  koine: '0',
  name: 'team-decisions',
  version: '2026.09.0',
  integrity: 'sha256:'.padEnd(71, '0'),
  ...extra,
})

describe('R1 — a package declaring a capability this reader implements installs, and it is recorded', () => {
  it('validates, and the declaration survives to the consumer', () => {
    const read = validateManifest(manifest({ requires: ['absent-body'] }))
    expect(read.requires).toEqual(['absent-body'])
    expect(checkCapabilities(read.requires, ['absent-body', 'locator'])).toEqual({ honoured: true, missing: [] })
  })

  it('carries a vendor capability under reverse-DNS, beside a core one', () => {
    const read = validateManifest(manifest({ requires: ['absent-body', 'org.noebase.record-facets'] }))
    expect(read.requires).toHaveLength(2)
  })
})

describe('R2 — a package declaring a capability this reader does NOT implement is refused, naming it', () => {
  it('names exactly what is missing, and nothing is honoured', () => {
    const check = checkCapabilities(['absent-body', 'org.acme.retraction'], ['absent-body'])
    expect(check).toEqual({ honoured: false, missing: ['org.acme.retraction'] })
  })

  it('refuses a manifest whose requires cannot be parsed — an unhonourable rule is not a soft one', () => {
    expect(() => validateManifest(manifest({ requires: 'absent-body' }))).toThrow(/must be an array/)
    expect(() => validateManifest(manifest({ requires: ['Absent_Body'] }))).toThrow(/neither a registered core token/)
    expect(() => validateManifest(manifest({ requires: ['no-such-core-thing'] }))).toThrow(/registers none by that name/)
    expect(() => validateManifest(manifest({ requires: ['locator', 'locator'] }))).toThrow(/twice/)
  })

  it('registers exactly the three whose absence makes a reader CONFIDENTLY wrong', () => {
    // Not `state`, not the commit binding, not the four verdicts: ignoring those
    // costs a reader completeness and it knows it. These three make it draw a
    // wrong conclusion — that it holds every body, that a pointer means the
    // whole document, that a withdrawn package is current.
    expect(Object.keys(REGISTERED_CAPABILITIES).sort()).toEqual(['absent-body', 'locator', 'status-source'])
  })
})

describe('R3 — the two mechanisms do not collapse into one', () => {
  it('still carries an unknown x- key verbatim through emit and re-emit', async () => {
    const schema = {
      type: 'object',
      properties: { kind: { const: 'thing' } },
      'x-noebase-cascade': 'cold',
      'x-someone-else-unknown': { deep: [1, 2, 3] },
    }
    const first = await emitKoineTree({
      nodes: [{ id: 'n-a', path: 'a.md', format: 'markdown', bytes: '# a\n' }],
      types: { records: [{ name: 'thing', schema }] },
    })
    const parsed = parseKoineTree(first)
    expect(parsed.dictionaries.records?.[0]?.schema).toEqual(schema)
    const second = await emitKoineTree({
      nodes: [{ id: 'n-a', path: 'a.md', format: 'markdown', bytes: '# a\n' }],
      types: parsed.dictionaries,
    })
    expect(second.get('.koine/types/thing.schema.json')).toBe(first.get('.koine/types/thing.schema.json') as string)
  })

  it('an x- key is ignorable and a requires entry is not — that is the whole distinction', () => {
    // Nothing anywhere refuses a tree for an unknown `x-` key…
    expect(checkCapabilities(undefined, [])).toEqual({ honoured: true, missing: [] })
    // …and a declared capability the reader lacks refuses it by name.
    expect(checkCapabilities(['org.acme.thing'], []).honoured).toBe(false)
  })
})

describe('a package can say what it LACKS', () => {
  it('declares a referenced-but-absent body, keeping its digest so it can be checked elsewhere', async () => {
    const digest = await hash('a very large video\n')
    const files = await emitKoineTree({
      nodes: [
        { id: 'n-doc', path: 'report.md', format: 'markdown', bytes: '# Report\n' },
        {
          id: 'n-vid',
          path: 'evidence/trial.mp4',
          format: 'mp4',
          contentHash: digest,
          absent: { reason: 'oversize', required: true },
        },
      ],
      requires: ['absent-body'],
    })
    // The body is NOT in the tree — that is the declaration — and the row is.
    expect(files.has('evidence/trial.mp4')).toBe(false)
    const parsed = parseKoineTree(files)
    expect(parsed.nodes.find((n) => n.id === 'n-vid')).toEqual({
      id: 'n-vid',
      path: 'evidence/trial.mp4',
      format: 'mp4',
      contentHash: digest,
      absent: { reason: 'oversize', required: true },
    })
    expect(parsed.requires).toEqual(['absent-body'])
    // Incomplete is not invalid: the tree verifies, and says what it lacks.
    const verdict = await verifyKoineTree(files)
    expect(verdict.integrity.status).toBe('pass')
  })

  it('refuses to EMIT an absence it does not require a reader to honour', async () => {
    await expect(
      emitKoineTree({
        nodes: [
          { id: 'n-doc', path: 'report.md', format: 'markdown', bytes: '# Report\n' },
          { id: 'n-vid', path: 'v.mp4', format: 'mp4', contentHash: await hash('x'), absent: {} },
        ],
      }),
    ).rejects.toThrow(/does not require the "absent-body" capability/)
  })

  it('refuses to PARSE one either — such a tree is malformed, not merely suspect', async () => {
    const files = await emitKoineTree({
      nodes: [
        { id: 'n-doc', path: 'report.md', format: 'markdown', bytes: '# Report\n' },
        { id: 'n-vid', path: 'v.mp4', format: 'mp4', contentHash: await hash('x'), absent: {} },
      ],
      requires: ['absent-body'],
    })
    const stripped = new Map(files)
    stripped.delete(REQUIRES_PATH)
    expect(() => parseKoineTree(stripped)).toThrow(KoineParseError)
    expect(() => parseKoineTree(stripped)).toThrow(/does not require the "absent-body" capability/)
  })

  it('convicts a row that claims absence over a body the tree carries', async () => {
    const files = await emitKoineTree({
      nodes: [
        { id: 'n-doc', path: 'report.md', format: 'markdown', bytes: '# Report\n' },
        { id: 'n-vid', path: 'v.mp4', format: 'mp4', contentHash: await hash('x\n'), absent: {} },
      ],
      requires: ['absent-body'],
    })
    const lying = new Map(files).set('v.mp4', 'x\n')
    const verdict = await verifyKoineTree(lying)
    expect(verdict.integrity.status).toBe('fail')
    expect(verdict.integrity.problems[0]).toContain('one of the two is false')
  })

  it('lets a Locator address an absent body at the version the row declares', async () => {
    const declared = await hash('the missing body\n')
    const files = await emitKoineTree({
      nodes: [
        { id: 'n-claim', path: 'claim.md', format: 'markdown', bytes: '# Claim\n' },
        { id: 'n-gone', path: 'gone.pdf', format: 'pdf', contentHash: declared, absent: { reason: 'restricted' } },
      ],
      edges: [
        {
          from: 'n-claim',
          to: 'n-gone',
          type: 'references',
          toLocator: { contentHash: declared, selector: { type: 'page', number: 14 } },
        },
      ],
      requires: ['absent-body'],
    })
    // Pointing into a body the package withheld is legitimate and is exactly
    // why the row keeps the digest: the address is checkable without the bytes.
    expect((await verifyKoineTree(files)).references.status).toBe('pass')
  })

  it('refuses at emit a Locator into an absent body at a version the row does not declare', async () => {
    await expect(
      emitKoineTree({
        nodes: [
          { id: 'n-claim', path: 'claim.md', format: 'markdown', bytes: '# Claim\n' },
          { id: 'n-gone', path: 'gone.pdf', format: 'pdf', contentHash: await hash('one\n'), absent: {} },
        ],
        edges: [
          { from: 'n-claim', to: 'n-gone', type: 'references', toLocator: { contentHash: await hash('other\n') } },
        ],
        requires: ['absent-body'],
      }),
    ).rejects.toThrow(/already rotten/)
  })

  it('convicts the same mismatch at verify, in a tree this codec did not emit', async () => {
    const declared = await hash('the missing body\n')
    const other = await hash('a DIFFERENT body\n')
    const files = await emitKoineTree({
      nodes: [
        { id: 'n-claim', path: 'claim.md', format: 'markdown', bytes: '# Claim\n' },
        { id: 'n-gone', path: 'gone.pdf', format: 'pdf', contentHash: declared, absent: { reason: 'restricted' } },
      ],
      edges: [{ from: 'n-claim', to: 'n-gone', type: 'references', toLocator: { contentHash: declared } }],
      requires: ['absent-body'],
    })
    const forged = new Map(files).set(
      '.koine/edges.jsonl',
      (files.get('.koine/edges.jsonl') as string).replace(declared, other),
    )
    const verdict = await verifyKoineTree(forged)
    expect(verdict.references.status).toBe('fail')
    expect(verdict.references.problems[0]).toContain('absent')
  })
})

describe('a package can say where its own standing is published', () => {
  it('accepts an absolute URL and refuses anything else', () => {
    expect(validateManifest(manifest({ status: 'https://acme.example/pkg/status.json' })).status).toBe(
      'https://acme.example/pkg/status.json',
    )
    expect(() => validateManifest(manifest({ status: '/status.json' }))).toThrow(/absolute http\(s\) URL/)
    expect(() => validateManifest(manifest({ status: 42 }))).toThrow(/absolute http\(s\) URL/)
  })

  it('a package that declares none imports normally — no claim is made either way', () => {
    expect(validateManifest(manifest()).status).toBeUndefined()
  })
})

describe('the tree-grain declaration', () => {
  it('round-trips, sorted, and is omitted entirely when nothing is required', async () => {
    const files = await emitKoineTree({
      nodes: [{ id: 'n-a', path: 'a.md', format: 'markdown', bytes: 'x\n' }],
      requires: ['locator', 'absent-body'],
    })
    expect(parseRequiresJson(files.get(REQUIRES_PATH) as string).requires).toEqual(['absent-body', 'locator'])

    const bare = await emitKoineTree({ nodes: [{ id: 'n-a', path: 'a.md', format: 'markdown', bytes: 'x\n' }] })
    expect(bare.has(REQUIRES_PATH)).toBe(false)
    expect(parseKoineTree(bare).requires).toEqual([])
  })

  it('refuses a malformed token at emit rather than shipping an unhonourable demand', async () => {
    await expect(
      emitKoineTree({
        nodes: [{ id: 'n-a', path: 'a.md', format: 'markdown', bytes: 'x\n' }],
        requires: ['NOT A TOKEN'],
      }),
    ).rejects.toThrow(KoineEmitError)
  })
})
