/**
 * Koine codec — required capabilities (SPEC §8.1).
 *
 * Until this existed koine had exactly one extension shape — the `x-` namespace
 * — and it is **ignorable by construction**: §7.5 makes carrying-without-
 * understanding explicitly legal, which is the right rule for an optional facet
 * and the wrong one for a mandatory one. There was no `requires`, no crit-list,
 * no artifact-type discriminator, so a profile could not say *you must honour
 * this or refuse me*. A receiver that did not implement a publication or a
 * retraction rule imported the package anyway and said nothing.
 *
 * Every interchange format that survived multi-party use grew this mechanism —
 * JWT/COSE `crit`, OCI `artifactType`, JSON-LD `@protected` — and **the moment
 * to add one is before a second profile exists**: after that, every existing
 * profile is a compatibility constraint on the mechanism meant to govern it.
 *
 * The model is `crit`'s: a flat list of capability TOKENS, fine-grained enough
 * that a reader can refuse precisely instead of refusing a whole profile it
 * mostly implements.
 */

import { KoineParseError } from './types.js'

/**
 * The capability tokens this specification registers, and what implementing one
 * means. A vendor token is a reverse-DNS string (`org.example.something`) and
 * is never registered here.
 *
 * Note what is NOT on this list: `state`, the commit `node` binding and the
 * four-verdict result. Ignoring those costs a reader completeness, never
 * safety — it under-reads and knows it. The three below are different: ignore
 * one and the reader draws a **confident wrong conclusion** — that it holds
 * every body, that a pointer means the whole document, that a withdrawn package
 * is current.
 */
export const REGISTERED_CAPABILITIES: Readonly<Record<string, string>> = {
  locator: 'resolve an endpoint Locator (§3.4), and report a stale one rather than a region',
  'absent-body': 'read a node row marked absent (§3.2), and refuse to activate on a required one',
  'status-source': "read a package's declared status source (§7.3), and render an unreachable one as possibly-stale",
}

/** A reverse-DNS vendor token: at least two dot-separated segments, no leading dot. */
const VENDOR_TOKEN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/

/** A registered core token: lowercase, hyphenated, no dots — so the two namespaces cannot collide. */
const CORE_TOKEN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/

/** Where `.koine/requires.json` lives — the tree-grain declaration. */
export const REQUIRES_PATH = '.koine/requires.json'

/** The tree-grain declaration document. */
export interface KoineRequires {
  /** Spec version this declaration targets. */
  readonly koine: string
  /** Capability tokens a reader MUST implement to read this artifact faithfully. */
  readonly requires: readonly string[]
}

/** Validate one token's SHAPE — membership in the registry is a separate question. */
export function capabilityTokenProblem(token: unknown): string | undefined {
  if (typeof token !== 'string' || token === '') return 'a capability token must be a non-empty string'
  if (VENDOR_TOKEN.test(token)) return undefined
  if (!CORE_TOKEN.test(token)) {
    return `"${token}" is neither a registered core token nor a reverse-DNS vendor token`
  }
  if (!Object.hasOwn(REGISTERED_CAPABILITIES, token)) {
    return `"${token}" looks like a core capability and this specification registers none by that name`
  }
  return undefined
}

/** Validate a whole `requires` list. Returns the problem, or `undefined`. */
export function requiresProblem(value: unknown): string | undefined {
  if (!Array.isArray(value)) return '"requires" must be an array of capability tokens'
  const seen = new Set<string>()
  for (const token of value) {
    const problem = capabilityTokenProblem(token)
    if (problem !== undefined) return problem
    if (seen.has(token as string)) return `"requires" lists "${token as string}" twice`
    seen.add(token as string)
  }
  return undefined
}

/** Parse `.koine/requires.json`'s bytes, or raise a located parse error. */
export function parseRequiresJson(text: string): KoineRequires {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new KoineParseError(REQUIRES_PATH, 1, 'is not valid JSON')
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new KoineParseError(REQUIRES_PATH, 1, 'is not a JSON object')
  }
  const document = parsed as Record<string, unknown>
  if (typeof document['koine'] !== 'string') {
    throw new KoineParseError(REQUIRES_PATH, 1, 'is missing its "koine" spec-version field')
  }
  const problem = requiresProblem(document['requires'])
  if (problem !== undefined) throw new KoineParseError(REQUIRES_PATH, 1, problem)
  return { koine: document['koine'], requires: [...(document['requires'] as string[])] }
}

/** Emit `.koine/requires.json` — indented JSON, like every dictionary document (§1.4). */
export function emitRequiresJson(requires: KoineRequires): string {
  return `${JSON.stringify({ koine: requires.koine, requires: [...requires.requires].sort() }, null, 2)}\n`
}

/** What a reader learns when it checks an artifact's demands against its own. */
export interface CapabilityCheck {
  /** True when every declared capability is implemented — the ONLY state in which reading may proceed. */
  readonly honoured: boolean
  /** The declared tokens this reader does not implement. */
  readonly missing: readonly string[]
}

/**
 * The must-understand rule, in one function: does this reader implement
 * everything the artifact demands?
 *
 * A caller that gets `honoured: false` **MUST refuse the artifact** — not
 * import it, not materialize it, not answer from it — and say which capability
 * it lacks. Importing-and-guessing is the behaviour this mechanism exists to
 * make impossible, and a reader that logs a warning and continues has
 * implemented the warning, not the rule.
 */
export function checkCapabilities(
  declared: readonly string[] | undefined,
  implemented: Iterable<string>,
): CapabilityCheck {
  const have = new Set(implemented)
  const missing = (declared ?? []).filter((token) => !have.has(token))
  return { honoured: missing.length === 0, missing }
}
