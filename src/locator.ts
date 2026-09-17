/**
 * Koine codec — the Locator (SPEC §3.4).
 *
 * A Locator is how an endpoint addresses a PART of a body and says which
 * version it addressed. It is deliberately NOT a new dictionary and not a new
 * kind of thing: an edge endpoint that was `{node}` becomes
 * `{node, contentHash, selector}` — the relation's *kind* stays the edge type's
 * business, the endpoint's *address* is this.
 *
 * **`contentHash` is required, and that is the whole point.** Every anchor
 * standard in the field resolves a pointer against whatever the body says
 * today; when the body is replaced the pointer still resolves and now names
 * something else — silently. With the hash inside the Locator a receiver can
 * answer *"this was taken against a version you no longer hold"*, which is the
 * honest answer and the one nobody can give without it.
 *
 * The selector vocabulary is **closed** — six types, each with prior art in the
 * field, chosen by measuring the formats knowledge actually travels in rather
 * than by imagining them. Widening it is a spec revision, never a vendor
 * extension: a receiver that silently ignored an address it did not understand
 * would read *"supports page 14"* as *"supports the document"*.
 */

import { sha256Hex } from './sha256.js'
import type { KoineContentHash, KoineLocator, KoineSelector } from './types.js'
import { KoineParseError } from './types.js'

/** The six selector types, in the order SPEC §3.4 declares them. */
export const SELECTOR_TYPES = [
  'text-quote',
  'text-position',
  'line-range',
  'page',
  'time-range',
  'json-pointer',
] as const

const SELECTOR_TYPE_SET: ReadonlySet<string> = new Set(SELECTOR_TYPES)

const utf8 = new TextEncoder()
const utf8Decoder = new TextDecoder()

const textOf = (value: Uint8Array | string): string =>
  typeof value === 'string' ? value : utf8Decoder.decode(value)

// ---------------------------------------------------------------------------
// Validation — the closed vocabulary, enforced at the codec boundary
// ---------------------------------------------------------------------------

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v)
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isStr = (v: unknown): v is string => typeof v === 'string'

/**
 * Validate a selector against the closed vocabulary. Returns the problem, or
 * `undefined` when the selector is well-formed. Shared by emit (which throws)
 * and parse (which raises a located parse error), so one description of the
 * vocabulary serves both directions.
 */
export function selectorProblem(selector: unknown): string | undefined {
  if (typeof selector !== 'object' || selector === null || Array.isArray(selector)) {
    return 'selector must be a JSON object'
  }
  const s = selector as Record<string, unknown>
  const type = s['type']
  if (!isStr(type)) return 'selector is missing its "type"'
  if (!SELECTOR_TYPE_SET.has(type)) {
    return `unknown selector type "${type}" — the vocabulary is closed: ${SELECTOR_TYPES.join(', ')}`
  }
  switch (type) {
    case 'text-quote':
      if (!isStr(s['exact']) || s['exact'] === '') return 'text-quote needs a non-empty "exact"'
      if (s['prefix'] !== undefined && !isStr(s['prefix'])) return 'text-quote "prefix" must be a string'
      if (s['suffix'] !== undefined && !isStr(s['suffix'])) return 'text-quote "suffix" must be a string'
      return undefined
    case 'text-position':
      if (!isInt(s['start']) || (s['start'] as number) < 0) return 'text-position needs a non-negative integer "start"'
      if (!isInt(s['end']) || (s['end'] as number) < 0) return 'text-position needs a non-negative integer "end"'
      if ((s['end'] as number) < (s['start'] as number)) return 'text-position "end" precedes "start"'
      return undefined
    case 'line-range':
      if (!isInt(s['start']) || (s['start'] as number) < 1) return 'line-range needs a 1-based integer "start"'
      if (s['end'] !== undefined) {
        if (!isInt(s['end']) || (s['end'] as number) < 1) return 'line-range "end" must be a 1-based integer'
        if ((s['end'] as number) < (s['start'] as number)) return 'line-range "end" precedes "start"'
      }
      return undefined
    case 'page':
      if (!isInt(s['number']) || (s['number'] as number) < 1) return 'page needs a 1-based integer "number"'
      return undefined
    case 'time-range':
      if (!isNum(s['start']) || (s['start'] as number) < 0) return 'time-range needs a non-negative "start" in seconds'
      if (s['end'] !== undefined) {
        if (!isNum(s['end']) || (s['end'] as number) < 0) return 'time-range "end" must be a number of seconds'
        if ((s['end'] as number) < (s['start'] as number)) return 'time-range "end" precedes "start"'
      }
      return undefined
    case 'json-pointer':
      if (!isStr(s['pointer'])) return 'json-pointer needs a string "pointer"'
      if (s['pointer'] !== '' && !(s['pointer'] as string).startsWith('/')) {
        return 'json-pointer "pointer" must be "" or start with "/" (RFC 6901)'
      }
      return undefined
    default:
      return `unknown selector type "${type}"`
  }
}

/** Validate a whole Locator. Returns the problem, or `undefined`. */
export function locatorProblem(locator: unknown): string | undefined {
  if (typeof locator !== 'object' || locator === null || Array.isArray(locator)) {
    return 'locator must be a JSON object'
  }
  const l = locator as Record<string, unknown>
  const hash = l['contentHash']
  if (!isStr(hash) || !/^sha256:[0-9a-f]{64}$/.test(hash)) {
    return 'locator contentHash must be "sha256:" + 64 lowercase hex chars — a Locator without it is not one'
  }
  if (l['selector'] !== undefined) {
    const problem = selectorProblem(l['selector'])
    if (problem !== undefined) return problem
  }
  return undefined
}

/** Parse a Locator out of already-parsed JSON, or raise a located parse error. */
export function parseLocator(file: string, line: number, raw: unknown): KoineLocator {
  const problem = locatorProblem(raw)
  if (problem !== undefined) throw new KoineParseError(file, line, problem)
  const l = raw as Record<string, unknown>
  return {
    contentHash: l['contentHash'] as KoineContentHash,
    ...(l['selector'] !== undefined ? { selector: l['selector'] as KoineSelector } : {}),
  }
}

/** Canonical key order for a Locator, so parse → re-emit is byte-identical. */
export function canonicalLocator(locator: KoineLocator): Record<string, unknown> {
  return {
    contentHash: locator.contentHash,
    ...(locator.selector !== undefined ? { selector: canonicalSelector(locator.selector) } : {}),
  }
}

/** Canonical key order per selector type — `type` first, then the type's own fields. */
export function canonicalSelector(selector: KoineSelector): Record<string, unknown> {
  switch (selector.type) {
    case 'text-quote':
      return {
        type: selector.type,
        exact: selector.exact,
        ...(selector.prefix !== undefined ? { prefix: selector.prefix } : {}),
        ...(selector.suffix !== undefined ? { suffix: selector.suffix } : {}),
      }
    case 'text-position':
      return { type: selector.type, start: selector.start, end: selector.end }
    case 'line-range':
      return {
        type: selector.type,
        start: selector.start,
        ...(selector.end !== undefined ? { end: selector.end } : {}),
      }
    case 'page':
      return { type: selector.type, number: selector.number }
    case 'time-range':
      return {
        type: selector.type,
        start: selector.start,
        ...(selector.end !== undefined ? { end: selector.end } : {}),
      }
    case 'json-pointer':
      return { type: selector.type, pointer: selector.pointer }
  }
}

// ---------------------------------------------------------------------------
// Resolution — four honest answers
// ---------------------------------------------------------------------------

/** The region a resolved Locator names, where the codec can compute one. */
export type ResolvedRegion =
  /** A span of the body's text, in Unicode code points. */
  | { readonly kind: 'text'; readonly start: number; readonly end: number; readonly text: string }
  /** The value a JSON Pointer reached. */
  | { readonly kind: 'value'; readonly value: unknown }

/**
 * What resolving a Locator against a body yields. Four answers, and the honest
 * middle two are the reason the shape exists at all:
 *
 * - `resolved` — the version matches and the region was computed.
 * - `stale` — the body's hash has moved. **This is the answer nobody can give
 *   without a Locator's `contentHash`,** and it is never silently downgraded
 *   into a best-effort region.
 * - `opaque` — the version matches and the address is well-formed, but naming
 *   the region needs a format-aware reader (a PDF page, a media offset). The
 *   codec refuses to pretend it decoded something it did not.
 * - `not-found` — the version matches and the selector reaches nothing.
 */
export type LocatorResolution =
  | { readonly status: 'resolved'; readonly region: ResolvedRegion }
  | { readonly status: 'stale'; readonly expected: KoineContentHash; readonly actual: KoineContentHash }
  | { readonly status: 'opaque'; readonly reason: string }
  | { readonly status: 'not-found'; readonly reason: string }

/**
 * Resolve a Locator against a body whose content hash the caller ALREADY
 * COMPUTED — the hot-loop variant, for a caller verifying a whole tree that
 * hashes each body once.
 *
 * **Prefer {@link resolveLocator}, which derives the hash itself.** The `stale`
 * answer — the one thing this shape exists to give, and the one no other anchor
 * vocabulary can — is only worth anything if `actualHash` really is the hash of
 * `body`. A caller that passes `locator.contentHash` here gets `resolved` for
 * every pointer, always, and nothing says so: the same shape that let a genuine
 * seal over one package admit another, one layer down.
 *
 * Found by running that shape as a query over the whole source rather than by
 * being reported. Kept, because the whole-tree verifier genuinely needs it and
 * hashing per Locator would be quadratic; renamed, so reaching for it is a
 * decision rather than the default.
 */
export function resolveLocatorAgainst(
  locator: KoineLocator,
  body: Uint8Array | string,
  actualHash: KoineContentHash,
): LocatorResolution {
  if (actualHash !== locator.contentHash) {
    return { status: 'stale', expected: locator.contentHash, actual: actualHash }
  }
  const selector = locator.selector
  if (selector === undefined) {
    // A Locator with no selector addresses the whole of this version — a
    // version-pinned whole-node reference, which is a real and useful thing.
    const text = textOf(body)
    return { status: 'resolved', region: { kind: 'text', start: 0, end: [...text].length, text } }
  }

  switch (selector.type) {
    case 'text-quote':
      return resolveQuote(selector.exact, selector.prefix, selector.suffix, textOf(body))
    case 'text-position':
      return resolvePosition(selector.start, selector.end, textOf(body))
    case 'line-range':
      return resolveLines(selector.start, selector.end, textOf(body))
    case 'json-pointer':
      return resolvePointer(selector.pointer, textOf(body))
    case 'page':
      return { status: 'opaque', reason: `page ${selector.number} needs a format-aware reader` }
    case 'time-range':
      return {
        status: 'opaque',
        reason: `the interval from ${selector.start}s needs a format-aware reader`,
      }
  }
}

function resolveQuote(
  exact: string,
  prefix: string | undefined,
  suffix: string | undefined,
  text: string,
): LocatorResolution {
  const hits: number[] = []
  let at = text.indexOf(exact)
  while (at !== -1) {
    const prefixOk = prefix === undefined || text.slice(Math.max(0, at - prefix.length), at) === prefix
    const after = at + exact.length
    const suffixOk = suffix === undefined || text.slice(after, after + suffix.length) === suffix
    if (prefixOk && suffixOk) hits.push(at)
    at = text.indexOf(exact, at + 1)
  }
  if (hits.length === 0) return { status: 'not-found', reason: 'the quoted text is not in this body' }
  if (hits.length > 1) {
    return {
      status: 'not-found',
      reason: `the quoted text occurs ${hits.length} times — prefix/suffix context does not disambiguate it`,
    }
  }
  const utf16Start = hits[0] as number
  const start = [...text.slice(0, utf16Start)].length
  return {
    status: 'resolved',
    region: { kind: 'text', start, end: start + [...exact].length, text: exact },
  }
}

function resolvePosition(start: number, end: number, text: string): LocatorResolution {
  const points = [...text]
  if (end > points.length) {
    return { status: 'not-found', reason: `position ${end} is past the end of this body (${points.length})` }
  }
  return { status: 'resolved', region: { kind: 'text', start, end, text: points.slice(start, end).join('') } }
}

function resolveLines(start: number, end: number | undefined, text: string): LocatorResolution {
  const lines = text.split('\n')
  // A trailing newline produces a final empty element that is not a line.
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop()
  const last = end ?? start
  if (start > lines.length) {
    return { status: 'not-found', reason: `line ${start} is past the end of this body (${lines.length} lines)` }
  }
  const slice = lines.slice(start - 1, Math.min(last, lines.length))
  const before = lines.slice(0, start - 1).join('\n')
  const offset = start === 1 ? 0 : [...before].length + 1
  const body = slice.join('\n')
  return { status: 'resolved', region: { kind: 'text', start: offset, end: offset + [...body].length, text: body } }
}

/** RFC 6901 unescaping: `~1` is `/`, `~0` is `~`, in that order. */
const unescapeToken = (token: string): string => token.replace(/~1/g, '/').replace(/~0/g, '~')

function resolvePointer(pointer: string, text: string): LocatorResolution {
  let document: unknown
  try {
    document = JSON.parse(text)
  } catch {
    return { status: 'not-found', reason: 'a json-pointer addresses a body that is not valid JSON' }
  }
  if (pointer === '') return { status: 'resolved', region: { kind: 'value', value: document } }

  let cursor: unknown = document
  for (const token of pointer.slice(1).split('/').map(unescapeToken)) {
    if (Array.isArray(cursor)) {
      if (!/^(0|[1-9][0-9]*)$/.test(token)) {
        return { status: 'not-found', reason: `"${token}" is not an array index in "${pointer}"` }
      }
      const index = Number(token)
      if (index >= cursor.length) {
        return { status: 'not-found', reason: `index ${index} is past the end of the array at "${pointer}"` }
      }
      cursor = cursor[index]
    } else if (typeof cursor === 'object' && cursor !== null) {
      const record = cursor as Record<string, unknown>
      if (!Object.hasOwn(record, token)) {
        return { status: 'not-found', reason: `"${token}" is not a key on the object at "${pointer}"` }
      }
      cursor = record[token]
    } else {
      return { status: 'not-found', reason: `"${pointer}" descends into a scalar` }
    }
  }
  return { status: 'resolved', region: { kind: 'value', value: cursor } }
}

/**
 * Resolve a Locator against a body, DERIVING the body's hash rather than being
 * told it — the one to reach for.
 *
 * Async because the hash is: WebCrypto's digest is the only hashing this package
 * does, and a synchronous answer would have to be handed a claim.
 */
export async function resolveLocator(
  locator: KoineLocator,
  body: Uint8Array | string,
): Promise<LocatorResolution> {
  const actual: KoineContentHash = `sha256:${await sha256Hex(typeof body === 'string' ? utf8.encode(body) : body)}`
  return resolveLocatorAgainst(locator, body, actual)
}
