/**
 * Koine codec — the shape block (SPEC §2.2).
 *
 * A definition declares its shape in a fenced code block with the info string
 * `shape`, inside its own body. This module is the normative parse, in one
 * place, because three chapters depend on the same bytes meaning the same
 * thing: §2.2 binds `kind:` to a record type, §4 reads `state:` off it, and
 * chapter 5's receipt steps 3 and 4 validate against what it yields.
 *
 * Until this module existed each of those was a caller's own reading, and the
 * validity gradient had no reader at all inside the codec — the state was taken
 * from an emit-time parameter and written nowhere, so it could not survive its
 * own roundtrip.
 *
 * The grammar, verbatim from §2.2: at most one block per file, the first is
 * normative; one `key: value` per line; `key` matches `[a-z][a-z0-9-]*` and is
 * unique; the separator is the FIRST `": "`, the value is everything after it
 * with trailing whitespace stripped; values may contain `": "`; no escaping, no
 * comments; blank lines ignored.
 */

import type { KoineShapeBlock, KoineValidity } from './types.js'

const KEY_RE = /^[a-z][a-z0-9-]*$/

/** The four states of the gradient, in order (SPEC §4). */
export const VALIDITY_STATES = ['spoken', 'draft', 'valid', 'frozen'] as const

const VALIDITY_SET: ReadonlySet<string> = new Set(VALIDITY_STATES)

/** True when the string names a point on the gradient. */
export function isValidity(value: string): value is KoineValidity {
  return VALIDITY_SET.has(value)
}

/**
 * Find and parse the first ```shape fenced block in a body.
 *
 * Returns `undefined` when the body carries none — which is not an error and is
 * the common case: a floor-0 file without a shape block reads as an utterance
 * (§4), and most bodies are exactly that.
 *
 * A malformed block IS an error and is returned as one rather than thrown, so a
 * whole-tree verify can collect every body's problem instead of stopping at the
 * first.
 */
export function readShapeBlock(body: string): KoineShapeBlock | { readonly problem: string } | undefined {
  const lines = body.split('\n')
  let opened = -1
  let fence = ''
  for (let i = 0; i < lines.length; i++) {
    const match = /^(\s*)(`{3,}|~{3,})[ \t]*shape[ \t]*$/.exec(lines[i] as string)
    if (match !== null) {
      opened = i
      fence = match[2] as string
      break
    }
  }
  if (opened === -1) return undefined

  const closer = new RegExp(`^\\s*${fence[0] === '`' ? '`' : '~'}{${fence.length},}[ \\t]*$`)
  let closed = -1
  for (let i = opened + 1; i < lines.length; i++) {
    if (closer.test(lines[i] as string)) {
      closed = i
      break
    }
  }
  if (closed === -1) return { problem: 'the shape block is never closed' }

  const declarations = new Map<string, string>()
  for (let i = opened + 1; i < closed; i++) {
    const raw = lines[i] as string
    if (raw.trim() === '') continue
    const at = raw.indexOf(': ')
    if (at === -1) {
      return { problem: `shape block line ${i - opened} has no "key: value" separator` }
    }
    const key = raw.slice(0, at)
    if (!KEY_RE.test(key)) {
      return { problem: `shape block key "${key}" does not match [a-z][a-z0-9-]*` }
    }
    if (declarations.has(key)) {
      return { problem: `shape block declares "${key}" twice` }
    }
    declarations.set(key, raw.slice(at + 2).replace(/\s+$/, ''))
  }

  const kind = declarations.get('kind')
  if (kind === undefined || kind === '') {
    return { problem: 'the shape block declares no "kind" — §2.2 requires it' }
  }

  const declaredState = declarations.get('state')
  if (declaredState !== undefined && !isValidity(declaredState)) {
    return {
      problem: `"state: ${declaredState}" is not on the gradient — ${VALIDITY_STATES.join(' → ')}`,
    }
  }

  return {
    kind,
    ...(declaredState !== undefined ? { state: declaredState as KoineValidity } : {}),
    declarations,
  }
}

/** True when the value carries a `problem` rather than a parsed block. */
export function isShapeProblem(
  value: KoineShapeBlock | { readonly problem: string } | undefined,
): value is { readonly problem: string } {
  return value !== undefined && 'problem' in value
}

/**
 * The declared state of a body, as the identity map should carry it.
 *
 * `undefined` means the body declares none — and per §4 that is NOT the same as
 * declaring `spoken`. The distinction is the whole of the travel law's second
 * half: the gate refuses declared-but-unpromoted thinking, it does not require
 * declaration. Collapsing the two (`state ?? 'spoken'`) is the single line that
 * made the codec contradict §7.6.
 */
export function declaredState(body: string): KoineValidity | undefined {
  const block = readShapeBlock(body)
  if (block === undefined || isShapeProblem(block)) return undefined
  return block.state
}

/**
 * The state that TRAVELS for one body — the law, in one place, for both emitters.
 *
 * It was written twice: once in `emitKoineTree` and once in `sealPackage`, after
 * the second review round found that sealing dropped the state entirely. The
 * repair for *a law with two enforcers* introduced a second enforcer — and a
 * query for that shape, run after the fourth round, is what found it. Two copies
 * of one rule do not stay equal; they stay equal until someone edits one.
 *
 * The body's shape block is the declaration (§4). The `asserted` value — a
 * producer's field, or a prior identity-map row — answers only where the body is
 * silent. A contradiction is returned rather than thrown, because the two
 * callers owe different errors: an emit error and a manifest error.
 */
export function travellingState(
  bytes: Uint8Array | string,
  asserted: KoineValidity | undefined,
): { readonly state?: KoineValidity; readonly conflict?: { readonly asserted: KoineValidity; readonly declared: KoineValidity } } {
  let text: string
  try {
    text = typeof bytes === 'string' ? bytes : new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return asserted === undefined ? {} : { state: asserted } // a binary body carries no shape block
  }
  const block = readShapeBlock(text)
  if (block === undefined || isShapeProblem(block) || block.state === undefined) {
    return asserted === undefined ? {} : { state: asserted }
  }
  if (asserted !== undefined && asserted !== block.state) {
    return { conflict: { asserted, declared: block.state } }
  }
  return { state: block.state }
}