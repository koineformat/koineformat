/**
 * Koine codec — the type dictionaries as sidecar files.
 *
 * Serializers for the semantic layer travelling INSIDE a koine repo (its
 * grammar chapter): Record types → `types/<name>.schema.json`, Kinds →
 * `types/<name>.tagtype.json`, Link types → `types/<name>.edgetype.json`.
 *
 * Pure data-in serializers by design: the codec never reads a live registry —
 * the caller hands entries in. That is what keeps it dependency-free and lets a
 * fixture be a literal rather than a booted system.
 */

import { KoineParseError } from './types.js'
import type { KoineEdgeType, KoineRecordType, KoineTagType } from './types.js'

const TYPE_ID_PREFIX = 'koine/types/'
const TYPE_ID_VERSION = '@v0'

export const typeId = (name: string): string => `${TYPE_ID_PREFIX}${name}${TYPE_ID_VERSION}`

const pretty = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`

// ============================================
// The emit side — canonical key order
// ============================================

/**
 * **The emission convention, stated once for all three dictionaries.**
 *
 *   `$id` · identity (`name`, `description`) · the shared meaning-type facet
 *   (`cascade`) · the dictionary's own domain facets in declaration order ·
 *   custody (`provenance`) last.
 *
 * `cascade` sits at the same index in every dictionary because all three
 * meaning types share one base — name · description · cascade — so a reader
 * comparing two dictionary files finds the common facets in the common place.
 * A serializer that dropped `cascade` from one of the three would break that.
 *
 * **An optional facet is omitted entirely when absent — never emitted as
 * `null`.** That is what lets the form grow without rewriting history: a tree
 * written before a facet existed re-emits byte-for-byte unchanged, and the
 * recorded conformance vectors keep verifying against a codec that has since
 * learned more. A new facet is therefore added at the position its role
 * dictates above, never by widening an existing key.
 */

/** `types/<name>.schema.json` — the record type's JSON Schema, `$id`-stamped. */
export function emitRecordTypeJson(record: KoineRecordType): string {
  return pretty({ $id: typeId(record.name), ...record.schema })
}

/** `types/<name>.tagtype.json` — the Kind's declared behaviour facets, then its custody. */
export function emitTagTypeJson(tag: KoineTagType): string {
  return pretty({
    $id: typeId(tag.name),
    name: tag.name,
    description: tag.description,
    cascade: tag.cascade,
    proactivity: tag.proactivity,
    contentFormat: tag.contentFormat,
    ...(tag.provenance === undefined ? {} : { provenance: tag.provenance }),
  })
}

/** `types/<name>.edgetype.json` — the Link type's relationship semantics. */
export function emitEdgeTypeJson(edge: KoineEdgeType): string {
  return pretty({
    $id: typeId(edge.name),
    name: edge.name,
    description: edge.description,
    ...(edge.cascade === undefined ? {} : { cascade: edge.cascade }),
    directed: edge.directed,
    transitive: edge.transitive,
    weight: edge.weight,
  })
}

/** The sidecar filename for each dictionary entry kind. */
export const recordTypePath = (name: string): string => `types/${name}.schema.json`
export const tagTypePath = (name: string): string => `types/${name}.tagtype.json`
export const edgeTypePath = (name: string): string => `types/${name}.edgetype.json`

// ============================================
// The read side — inverses of the three emitters
// ============================================

/**
 * The read side exists because a *reader* of a foreign tree needs a grammar,
 * not raw JSON. `parseKoineTree` returning `Record<string, unknown>` per
 * dictionary file was enough for byte-identical re-emit and useless for the
 * one job the form has at a door: telling an importer what it just received.
 *
 * These three are strict on purpose. A dictionary file that cannot be read as
 * its declared shape is a `KoineParseError` naming the file and the field —
 * never a partially-filled object, because an importer that silently receives
 * half a type definition writes half a type into a workspace.
 */

/** Read `$id` off a dictionary file and strip the `koine/types/<name>@v0` frame. */
function requireString(
  file: string,
  raw: Readonly<Record<string, unknown>>,
  field: string,
): string {
  const value = raw[field]
  if (typeof value !== 'string') {
    throw new KoineParseError(file, 1, `dictionary entry is missing the string field \`${field}\``)
  }
  return value
}

function requireBoolean(
  file: string,
  raw: Readonly<Record<string, unknown>>,
  field: string,
): boolean {
  const value = raw[field]
  if (typeof value !== 'boolean') {
    throw new KoineParseError(file, 1, `dictionary entry is missing the boolean field \`${field}\``)
  }
  return value
}

/**
 * An optional facet is absent or well-formed — never half-read.
 *
 * Absent gives back `undefined`, and the caller omits the key rather than
 * setting it to `undefined`, so the emitter's "omitted when absent" rule holds
 * through a round-trip. Present-but-wrong-typed is a parse error like any
 * other: a file that says `cascade: 3` is malformed, not silently cascade-less.
 */
function optionalString(
  file: string,
  raw: Readonly<Record<string, unknown>>,
  field: string,
): string | undefined {
  const value = raw[field]
  if (value === undefined) return undefined
  if (typeof value !== 'string') {
    throw new KoineParseError(file, 1, `dictionary entry field \`${field}\` must be a string when present`)
  }
  return value
}

function optionalObject(
  file: string,
  raw: Readonly<Record<string, unknown>>,
  field: string,
): Readonly<Record<string, unknown>> | undefined {
  const value = raw[field]
  if (value === undefined) return undefined
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new KoineParseError(file, 1, `dictionary entry field \`${field}\` must be a JSON object when present`)
  }
  return value as Readonly<Record<string, unknown>>
}

/** `types/<name>.tagtype.json` → a Kind. `shape` is docked separately by the tree reader. */
export function parseTagTypeJson(
  file: string,
  raw: Readonly<Record<string, unknown>>,
): KoineTagType {
  const provenance = optionalObject(file, raw, 'provenance')
  return {
    name: requireString(file, raw, 'name'),
    description: requireString(file, raw, 'description'),
    cascade: requireString(file, raw, 'cascade'),
    proactivity: requireString(file, raw, 'proactivity'),
    contentFormat: requireString(file, raw, 'contentFormat'),
    ...(provenance === undefined ? {} : { provenance }),
  }
}

/** `types/<name>.edgetype.json` → a Link type. */
export function parseEdgeTypeJson(
  file: string,
  raw: Readonly<Record<string, unknown>>,
): KoineEdgeType {
  const cascade = optionalString(file, raw, 'cascade')
  return {
    name: requireString(file, raw, 'name'),
    description: requireString(file, raw, 'description'),
    ...(cascade === undefined ? {} : { cascade }),
    directed: requireBoolean(file, raw, 'directed'),
    transitive: requireBoolean(file, raw, 'transitive'),
    weight: requireString(file, raw, 'weight'),
  }
}

/**
 * `types/<name>.schema.json` → a Record type. The file IS the JSON Schema with
 * a `$id` stamped on it, so the inverse strips `$id` and keeps the rest
 * verbatim — a schema key this codec does not know still survives the trip.
 */
export function parseRecordTypeJson(
  name: string,
  raw: Readonly<Record<string, unknown>>,
): KoineRecordType {
  const { $id: _id, ...schema } = raw
  return { name, schema }
}
