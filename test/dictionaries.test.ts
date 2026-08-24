import { describe, expect, it } from 'bun:test'
import {
  edgeTypePath,
  emitEdgeTypeJson,
  emitRecordTypeJson,
  emitTagTypeJson,
  parseEdgeTypeJson,
  parseRecordTypeJson,
  parseTagTypeJson,
  recordTypePath,
  tagTypePath,
  typeId,
} from '../src/dictionaries.js'
import type { KoineEdgeType, KoineRecordType, KoineTagType } from '../src/types.js'

describe('typeId', () => {
  it('stamps the koine/types/ prefix and the @v0 version', () => {
    expect(typeId('active-member')).toBe('koine/types/active-member@v0')
  })
})

describe('emitRecordTypeJson', () => {
  const record: KoineRecordType = {
    name: 'active-member',
    schema: { type: 'object', properties: { id: { type: 'string' } } },
  }

  it('stamps $id and spreads the record\'s own schema, pretty-printed with a trailing newline', () => {
    const json = emitRecordTypeJson(record)
    expect(json.endsWith('\n')).toBe(true)
    expect(JSON.parse(json)).toEqual({
      $id: 'koine/types/active-member@v0',
      type: 'object',
      properties: { id: { type: 'string' } },
    })
  })
})

describe('emitTagTypeJson', () => {
  const tag: KoineTagType = {
    name: 'insight',
    description: 'A standalone realization',
    cascade: 'hot',
    proactivity: 'inject',
    contentFormat: 'text',
  }

  it('serializes every declared facet plus the stamped $id', () => {
    const json = emitTagTypeJson(tag)
    expect(JSON.parse(json)).toEqual({
      $id: 'koine/types/insight@v0',
      name: 'insight',
      description: 'A standalone realization',
      cascade: 'hot',
      proactivity: 'inject',
      contentFormat: 'text',
    })
  })
})

describe('emitEdgeTypeJson', () => {
  const edge: KoineEdgeType = {
    name: 'derives-from',
    description: 'The target is the origin of the source',
    directed: true,
    transitive: false,
    weight: 'strong',
  }

  it('serializes every declared facet plus the stamped $id', () => {
    const json = emitEdgeTypeJson(edge)
    expect(JSON.parse(json)).toEqual({
      $id: 'koine/types/derives-from@v0',
      name: 'derives-from',
      description: 'The target is the origin of the source',
      directed: true,
      transitive: false,
      weight: 'strong',
    })
  })
})

describe('sidecar filenames', () => {
  it('names each dictionary kind under types/', () => {
    expect(recordTypePath('active-member')).toBe('types/active-member.schema.json')
    expect(tagTypePath('insight')).toBe('types/insight.tagtype.json')
    expect(edgeTypePath('derives-from')).toBe('types/derives-from.edgetype.json')
  })
})

// ---------------------------------------------------------------------------
// The read side — the inverses. Strict on purpose: an importer that receives
// half a type definition writes half a type into a workspace.
// ---------------------------------------------------------------------------

describe('parseTagTypeJson / parseEdgeTypeJson / parseRecordTypeJson', () => {
  it('round-trips a Kind through emit → parse', () => {
    const tag: KoineTagType = {
      name: 'insight',
      description: 'A standalone realization',
      cascade: 'hot',
      proactivity: 'inject',
      contentFormat: 'markdown',
    }
    const raw = JSON.parse(emitTagTypeJson(tag)) as Record<string, unknown>
    expect(parseTagTypeJson('insight.tagtype.json', raw)).toEqual(tag)
  })

  it('round-trips a Link type through emit → parse', () => {
    const edge: KoineEdgeType = {
      name: 'derives-from',
      description: 'B was derived from A',
      directed: true,
      transitive: false,
      weight: 'strong',
    }
    const raw = JSON.parse(emitEdgeTypeJson(edge)) as Record<string, unknown>
    expect(parseEdgeTypeJson('derives-from.edgetype.json', raw)).toEqual(edge)
  })

  it('strips $id off a Record type and keeps every other key verbatim — including one the codec does not know', () => {
    const raw = {
      $id: 'koine/types/active-member@v0',
      type: 'object',
      properties: { id: { type: 'string' } },
      'x-future-spec-key': 'survives the trip',
    }
    expect(parseRecordTypeJson('active-member', raw)).toEqual({
      name: 'active-member',
      schema: {
        type: 'object',
        properties: { id: { type: 'string' } },
        'x-future-spec-key': 'survives the trip',
      },
    })
  })

  it('names the file AND the missing field rather than returning a half-filled type', () => {
    expect(() => parseTagTypeJson('insight.tagtype.json', { name: 'insight' }))
      .toThrow(/insight\.tagtype\.json.*`description`/)
    expect(() =>
      parseEdgeTypeJson('derives-from.edgetype.json', {
        name: 'derives-from',
        description: 'x',
        weight: 'strong',
      }),
    ).toThrow(/derives-from\.edgetype\.json.*`directed`/)
  })
})

// ---------------------------------------------------------------------------
// The optional facets — custody on a Kind, cascade on a Link type.
//
// Both are additions to a form that is already in the world: the example repo's
// files, the chain conformance vectors, every tree already emitted anywhere. So
// the load-bearing assertion here is not that the new facets travel — it is
// that a dictionary WITHOUT them emits the exact bytes it emitted before.
// ---------------------------------------------------------------------------

/** Frozen: the bytes a Kind with no custody emits. An optional facet may not move one of them. */
const TAGTYPE_WITHOUT_OPTIONALS = `{
  "$id": "koine/types/insight@v0",
  "name": "insight",
  "description": "A standalone realization",
  "cascade": "hot",
  "proactivity": "inject",
  "contentFormat": "text"
}
`

/** Frozen: the bytes a Link type with no declared cascade emits. */
const EDGETYPE_WITHOUT_OPTIONALS = `{
  "$id": "koine/types/derives-from@v0",
  "name": "derives-from",
  "description": "The target is the origin of the source",
  "directed": true,
  "transitive": false,
  "weight": "strong"
}
`

describe('the optional facets', () => {
  const bareTag: KoineTagType = {
    name: 'insight',
    description: 'A standalone realization',
    cascade: 'hot',
    proactivity: 'inject',
    contentFormat: 'text',
  }

  const bareEdge: KoineEdgeType = {
    name: 'derives-from',
    description: 'The target is the origin of the source',
    directed: true,
    transitive: false,
    weight: 'strong',
  }

  it('emits byte-for-byte what it emitted before when neither facet is present', () => {
    expect(emitTagTypeJson(bareTag)).toBe(TAGTYPE_WITHOUT_OPTIONALS)
    expect(emitEdgeTypeJson(bareEdge)).toBe(EDGETYPE_WITHOUT_OPTIONALS)
  })

  it('omits an absent facet from the parsed type rather than carrying an undefined key', () => {
    const tag = parseTagTypeJson('insight.tagtype.json', JSON.parse(TAGTYPE_WITHOUT_OPTIONALS))
    const edge = parseEdgeTypeJson('derives-from.edgetype.json', JSON.parse(EDGETYPE_WITHOUT_OPTIONALS))
    expect(Object.keys(tag)).not.toContain('provenance')
    expect(Object.keys(edge)).not.toContain('cascade')
    // …and the round-trip therefore closes on the same bytes.
    expect(emitTagTypeJson(tag)).toBe(TAGTYPE_WITHOUT_OPTIONALS)
    expect(emitEdgeTypeJson(edge)).toBe(EDGETYPE_WITHOUT_OPTIONALS)
  })

  it('carries a Kind\'s custody verbatim, last in the canonical order', () => {
    const tag: KoineTagType = {
      ...bareTag,
      provenance: { plugin: 'research-kit', version: '1.2.0', seal: { by: 'actor:user:owner1' } },
    }
    const json = emitTagTypeJson(tag)
    expect(Object.keys(JSON.parse(json) as Record<string, unknown>)).toEqual([
      '$id', 'name', 'description', 'cascade', 'proactivity', 'contentFormat', 'provenance',
    ])
    // Verbatim: a custody key this codec does not know still survives the trip.
    expect(parseTagTypeJson('insight.tagtype.json', JSON.parse(json))).toEqual(tag)
  })

  it('carries a Link type\'s cascade at the shared meaning-type position', () => {
    const edge: KoineEdgeType = { ...bareEdge, cascade: 'cold' }
    const json = emitEdgeTypeJson(edge)
    // `cascade` sits where it sits on a Kind — third, right after the identity
    // pair — because all three meaning types share one base.
    expect(Object.keys(JSON.parse(json) as Record<string, unknown>)).toEqual([
      '$id', 'name', 'description', 'cascade', 'directed', 'transitive', 'weight',
    ])
    expect(parseEdgeTypeJson('derives-from.edgetype.json', JSON.parse(json))).toEqual(edge)
  })

  it('rejects a present-but-malformed facet instead of reading it as absent', () => {
    expect(() =>
      parseTagTypeJson('insight.tagtype.json', { ...bareTag, provenance: 'research-kit@1.2.0' }),
    ).toThrow(/insight\.tagtype\.json.*`provenance`.*JSON object/)
    expect(() =>
      parseTagTypeJson('insight.tagtype.json', { ...bareTag, provenance: ['research-kit'] }),
    ).toThrow(/`provenance`/)
    expect(() =>
      parseEdgeTypeJson('derives-from.edgetype.json', { ...bareEdge, cascade: 3 }),
    ).toThrow(/derives-from\.edgetype\.json.*`cascade`.*string/)
  })
})
