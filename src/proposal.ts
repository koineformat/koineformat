/**
 * Koine codec — the proposal receiver (SPEC §5).
 *
 * Law 2 makes the proposal the day-one gesture: *there is no merge — an incoming
 * version IS a proposal, and the field-wise conflict list IS the merge.* Chapter
 * 5 declared receipt semantics **normative**, in five ordered steps, and until
 * this module `grep -rni proposal src/` returned **one comment**. There was a
 * schema and a worked example and no receiver, no apply path, no fixtures, on
 * either side of the boundary.
 *
 * **A normative MUST with no reference implementation is not normative; it is a
 * wish** — nobody could check anyone's conformance to it, this project's own
 * included. That is the difference between a form knowledge LEAVES in and a form
 * knowledge TRAVELS in: without a receiver a package can be read and never
 * answered.
 *
 * Two grains meet here, and that is what the Locator (§3.4) bought:
 *
 * - a **shape proposal** changes a definition's declarations — field-wise, the
 *   original gesture, checked against the declared record type;
 * - a **body proposal** changes an addressed REGION of a body — which is how a
 *   text-range proposal from a live editor and this envelope can express each
 *   other at all. Before the Locator they could not: koine's target was
 *   field-grained and an editor's range is text-grained, so the day-one gesture
 *   and the day-one gesture could not meet.
 */

import { resolveLocator } from './locator.js'
import { coerceShapeValues, deepEqual, validateAgainstSchema } from './schema.js'
import { isShapeProblem, readShapeBlock } from './shape.js'
import type {
  KoineContentHash,
  KoineLocator,
  KoineSelector,
  ParsedKoineTree,
} from './types.js'

export const PROPOSAL_FORMAT = 'koine/proposal@v0'

/**
 * The reserved change field naming the addressed region of the body itself,
 * rather than a declaration inside it. One reserved name is what keeps the diff
 * field-wise — Law 2's shape — while letting an end land on prose.
 */
export const BODY_FIELD = 'body'

/** What a proposal points at: a node, the version it was drafted against, and optionally where inside it. */
export interface KoineProposalTarget {
  readonly nodeId: string
  readonly path: string
  readonly baseContentHash: KoineContentHash
  /** Present for a body proposal: WHERE in that version the change lands (§3.4). */
  readonly selector?: KoineSelector
}

/**
 * One field-wise change. `from`/`to` are arbitrary JSON — a shape is not all
 * strings — and either may be OMITTED to mean the field is absent on that side
 * (an addition, or a removal). `null` is the JSON value null, a different fact.
 */
export interface KoineProposalChange {
  readonly field: string
  readonly from?: unknown
  readonly to?: unknown
  readonly rationale?: string
}

/** A question the proposer could not decide, surfaced instead of silently resolved. */
export interface KoineOpenQuestion {
  readonly field?: string
  readonly question: string
}

/** The proposal envelope (SPEC §5, `koine/proposal@v0`). */
export interface KoineProposal {
  readonly format: typeof PROPOSAL_FORMAT
  readonly target: KoineProposalTarget
  readonly baseChainHead: string
  readonly schema: string
  readonly proposer: string
  readonly when: string
  readonly rationale: string
  readonly changes: readonly KoineProposalChange[]
  /** The complete shape after the changes. Absent for a body proposal — prose has no shape. */
  readonly resultingShape?: Readonly<Record<string, unknown>>
  readonly openQuestions?: readonly KoineOpenQuestion[]
  readonly notes?: string
}

/** True when this proposal changes an addressed region of the body rather than a declaration. */
export const isBodyProposal = (proposal: KoineProposal): boolean =>
  proposal.changes.length === 1 && proposal.changes[0]?.field === BODY_FIELD

// ---------------------------------------------------------------------------
// Step 1 — the envelope
// ---------------------------------------------------------------------------

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * Validate an incoming proposal against `koine/proposal@v0` — receipt step 1.
 * Returns the problems; empty means the envelope is well-formed.
 */
export function validateProposalEnvelope(value: unknown): string[] {
  const problems: string[] = []
  if (!isObject(value)) return ['the proposal is not a JSON object']
  if (value['format'] !== PROPOSAL_FORMAT) problems.push(`"format" must be "${PROPOSAL_FORMAT}"`)

  const target = value['target']
  if (!isObject(target)) {
    problems.push('"target" is required')
  } else {
    if (typeof target['nodeId'] !== 'string') problems.push('"target.nodeId" is required')
    if (typeof target['path'] !== 'string') problems.push('"target.path" is required')
    const base = target['baseContentHash']
    if (typeof base !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(base)) {
      problems.push('"target.baseContentHash" must be "sha256:" + 64 lowercase hex chars')
    }
  }

  if (typeof value['baseChainHead'] !== 'string' || !/^[0-9a-f]{64}$/.test(value['baseChainHead'])) {
    problems.push('"baseChainHead" must be 64 lowercase hex chars')
  }
  if (typeof value['schema'] !== 'string') problems.push('"schema" is required')
  if (typeof value['proposer'] !== 'string' || !/^actor:(user|agent):/.test(value['proposer'])) {
    problems.push('"proposer" must be actor:(user|agent):<id>')
  }
  if (typeof value['when'] !== 'string') problems.push('"when" is required (ISO-8601 UTC)')
  if (typeof value['rationale'] !== 'string') problems.push('"rationale" is required')

  const changes = value['changes']
  if (!Array.isArray(changes) || changes.length === 0) {
    problems.push('"changes" must be a non-empty array')
  } else {
    changes.forEach((change, i) => {
      if (!isObject(change)) {
        problems.push(`changes[${i}] is not an object`)
        return
      }
      if (typeof change['field'] !== 'string' || change['field'] === '') {
        problems.push(`changes[${i}].field is required`)
      }
      // `from`/`to` are ANY JSON, including `null`. Restricting them to strings
      // made a change to a number or a nested object unexpressible in the diff
      // that must EQUAL `resultingShape`.
      //
      // **An OMITTED `from` or `to` means the field is absent** on that side —
      // an addition or a removal. `null` is the JSON value null and is a
      // different fact. JSON has no way to write "not there" as a value, so the
      // key's presence carries it, and a change with neither is not a change.
      if (!Object.hasOwn(change, 'from') && !Object.hasOwn(change, 'to')) {
        problems.push(`changes[${i}] omits both "from" and "to" — that is not a change`)
      }
    })
  }

  const body = Array.isArray(changes) && changes.length === 1 && isObject(changes[0])
    && changes[0]['field'] === BODY_FIELD
  if (body) {
    if (!isObject(target) || target['selector'] === undefined) {
      problems.push(`a "${BODY_FIELD}" change must address a region — "target.selector" is required`)
    }
    if (value['resultingShape'] !== undefined) {
      problems.push(`a "${BODY_FIELD}" change carries no "resultingShape" — prose has no declared shape`)
    }
  } else if (!isObject(value['resultingShape'])) {
    problems.push('"resultingShape" is required for a shape proposal')
  }

  return problems
}

// ---------------------------------------------------------------------------
// Steps 2–5 — receipt
// ---------------------------------------------------------------------------

/** How a conflicting change is classified — §5 step 5. */
export type ConflictKind =
  /** The shape itself convicts one of the two candidates: no human is needed. */
  | 'one-is-wrong'
  /** Both candidates are valid shapes. Two people meant different things; a human decides. */
  | 'both-intentional'

/** One entry of the conflict list — the OUTPUT of receipt, not its cost. */
export interface KoineConflict {
  readonly field: string
  readonly kind: ConflictKind
  /** What the holder has now. */
  readonly current: unknown
  /** What the proposal was drafted against. */
  readonly base: unknown
  /** What the proposal asks for. */
  readonly proposed: unknown
  readonly why: string
}

/** The verdict of receiving a proposal. */
export interface KoineReceipt {
  /**
   * `stale` — the base moved (content or history): re-base or return, NEVER
   * force-apply. `inconsistent` — the recomputed diff does not equal `changes`,
   * or the envelope is malformed. `ready` — applicable, possibly with conflicts
   * a human must settle.
   */
  readonly status: 'ready' | 'stale' | 'inconsistent' | 'invalid'
  readonly problems: readonly string[]
  /** The conflict list. Empty on a clean `ready`. */
  readonly conflicts: readonly KoineConflict[]
  /** Questions the proposer could not decide — carried to the decider, never resolved here. */
  readonly openQuestions: readonly KoineOpenQuestion[]
  /**
   * The node as the tree holds it NOW — present whenever the target resolved.
   *
   * `path` may differ from `target.path`: an id outlives a path, so a document
   * renamed since drafting still resolves, and this is the only safe write
   * target. `renamed` says so out loud, because a receiver that silently
   * re-pointed would hide a fact the decider may want.
   */
  readonly resolved?: { readonly nodeId: string; readonly path: string; readonly renamed: boolean }
}

/** The shape a body currently declares, coerced against its record type. */
function currentShapeOf(
  body: string,
  schema: unknown,
): { shape: Record<string, unknown>; problem?: string } {
  const block = readShapeBlock(body)
  if (block === undefined) return { shape: {}, problem: 'the target body carries no shape block' }
  if (isShapeProblem(block)) return { shape: {}, problem: block.problem }
  return { shape: coerceShapeValues(block.declarations, schema) }
}

/**
 * Receive a proposal — SPEC §5's five normative steps, in order.
 *
 * 1. validate the envelope · 2. check staleness against `baseContentHash` and
 * `baseChainHead` · 3. validate the result against the declared record type (or,
 * for a body proposal, resolve the target region) · 4. recompute the diff and
 * require it to EQUAL `changes` · 5. produce the conflict list.
 *
 * Nothing here writes. Acceptance is {@link acceptProposal}, and separating them
 * is the point: receipt produces a conflict list for a decider, and a receiver
 * that applied as it read would have made step 5 unobservable.
 */
export function receiveProposal(
  proposal: unknown,
  tree: ParsedKoineTree,
  files: ReadonlyMap<string, Uint8Array | string>,
): KoineReceipt {
  const empty = { conflicts: [], openQuestions: [] } as const

  // ── 1. the envelope ────────────────────────────────────────────────────────
  const envelope = validateProposalEnvelope(proposal)
  if (envelope.length > 0) return { status: 'invalid', problems: envelope, ...empty }
  const p = proposal as KoineProposal
  const openQuestions = p.openQuestions ?? []

  const node = tree.nodes.find((n) => n.id === p.target.nodeId)
  if (node === undefined) {
    return {
      status: 'invalid',
      problems: [`the target node "${p.target.nodeId}" is not in this tree`],
      conflicts: [],
      openQuestions,
    }
  }

  // ── 2. staleness — mechanically detectable, never discovered mid-apply ─────
  const stale: string[] = []
  if (node.contentHash !== p.target.baseContentHash) {
    stale.push(
      `the body moved: drafted against ${p.target.baseContentHash}, the tree holds ${node.contentHash}`,
    )
  }
  const head = tree.chain?.links.at(-1)?.hash
  if (head !== undefined && head !== p.baseChainHead) {
    stale.push(`history moved: drafted at chain head ${p.baseChainHead}, the tree is at ${head}`)
  }
  if (stale.length > 0) return { status: 'stale', problems: stale, conflicts: [], openQuestions }

  const body = files.get(node.path)
  if (body === undefined) {
    return {
      status: 'invalid',
      problems: [`the target body "${node.path}" is not in this tree`],
      conflicts: [],
      openQuestions,
    }
  }
  const text = typeof body === 'string' ? body : new TextDecoder().decode(body)

  // The node as the tree holds it NOW. A rename is not a failure — an id
  // outlives a path (§3.2) — but it IS a fact the caller must have, because the
  // drafted path is no longer a safe write target.
  const resolved = {
    nodeId: node.id,
    path: node.path,
    renamed: node.path !== p.target.path,
  }
  const receipt = isBodyProposal(p)
    ? receiveBodyProposal(p, text, node.contentHash, openQuestions)
    : receiveShapeProposal(p, text, tree, openQuestions)
  return { ...receipt, resolved }
}

/** A body proposal: the addressed region must BE what the change says it replaces. */
function receiveBodyProposal(
  p: KoineProposal,
  text: string,
  contentHash: KoineContentHash,
  openQuestions: readonly KoineOpenQuestion[],
): KoineReceipt {
  const change = p.changes[0] as KoineProposalChange
  const locator: KoineLocator = {
    contentHash: p.target.baseContentHash,
    ...(p.target.selector !== undefined ? { selector: p.target.selector } : {}),
  }
  const resolution = resolveLocator(locator, text, contentHash)
  if (resolution.status === 'stale') {
    return {
      status: 'stale',
      problems: [`the addressed version is gone: ${resolution.expected} is now ${resolution.actual}`],
      conflicts: [],
      openQuestions,
    }
  }
  if (resolution.status !== 'resolved') {
    return {
      status: 'stale',
      problems: [`the proposal's region cannot be addressed in this body — ${resolution.reason}`],
      conflicts: [],
      openQuestions,
    }
  }
  const region = resolution.region.kind === 'text' ? resolution.region.text : resolution.region.value

  // Step 4, in the body grain: the region the proposal replaces must be the
  // region the tree holds. A proposal whose `from` is not what is there is
  // internally inconsistent in exactly the way a wrong field-wise diff is.
  if (!deepEqual(region, change.from)) {
    return {
      status: 'inconsistent',
      problems: [
        `the addressed region is ${JSON.stringify(region)} and the proposal replaces `
        + `${JSON.stringify(change.from)} — it was drafted against different text`,
      ],
      conflicts: [],
      openQuestions,
    }
  }
  return { status: 'ready', problems: [], conflicts: [], openQuestions }
}

/** A shape proposal: the recomputed diff must EQUAL `changes`, then the conflicts are classified. */
function receiveShapeProposal(
  p: KoineProposal,
  text: string,
  tree: ParsedKoineTree,
  openQuestions: readonly KoineOpenQuestion[],
): KoineReceipt {
  const resulting = p.resultingShape as Record<string, unknown>
  const kind = typeof resulting['kind'] === 'string' ? (resulting['kind'] as string) : undefined
  const record = kind === undefined ? undefined : recordSchemaFor(tree, kind)

  // **B5a, reported 2026-09-17.** `schema` is a DECLARED field of the envelope
  // and nothing read it: the record type was resolved from `resultingShape.kind`
  // alone, so a proposal naming a record type that does not exist — or naming a
  // different one than it actually changes — received `ready`. A declaration
  // nobody checks is worse than an absent one: it reads as agreement.
  const schemaProblem = schemaIdProblem(p.schema, kind, tree)
  if (schemaProblem !== undefined) {
    return { status: 'invalid', problems: [schemaProblem], conflicts: [], openQuestions }
  }
  const { shape: current, problem } = currentShapeOf(text, record)
  if (problem !== undefined) {
    return { status: 'invalid', problems: [problem], conflicts: [], openQuestions }
  }

  // ── 3. the result must be a legal instance of its declared record type ─────
  const problems: string[] = []
  if (record === undefined) {
    problems.push(
      `the proposal declares "${p.schema}" and this tree carries no record type for `
      + `"${kind ?? '(no kind in resultingShape)'}" — the result cannot be checked`,
    )
  } else {
    problems.push(...validateAgainstSchema(resulting, record).map((x) => `resultingShape: ${x}`))
  }

  // ── 4. diff(current, resulting) MUST equal `changes` ───────────────────────
  const recomputed = diffShapes(current, resulting)
  const declared = new Map(p.changes.map((c) => [c.field, c]))
  const mismatches: string[] = []
  for (const [field, change] of recomputed) {
    const claim = declared.get(field)
    if (claim === undefined) {
      mismatches.push(`"${field}" changes and the proposal does not declare it`)
    } else if (!deepEqual(claim.to, change.to)) {
      mismatches.push(`"${field}" is declared to become ${JSON.stringify(claim.to)} and becomes ${JSON.stringify(change.to)}`)
    }
  }
  for (const [field] of declared) {
    if (!recomputed.has(field)) mismatches.push(`"${field}" is declared to change and does not`)
  }
  if (mismatches.length > 0) {
    return {
      status: 'inconsistent',
      problems: [...problems, ...mismatches],
      conflicts: [],
      openQuestions,
    }
  }
  if (problems.length > 0) {
    // The result is not a legal instance. Every change is then convicted by the
    // shape rather than by a person — §5's `one-is-wrong`, and the reason that
    // classification needs no human.
    return {
      status: 'ready',
      problems,
      conflicts: p.changes.map((c) => ({
        field: c.field,
        kind: 'one-is-wrong' as const,
        current: current[c.field],
        base: c.from,
        proposed: c.to,
        why: problems.join('; '),
      })),
      openQuestions,
    }
  }

  // ── 5. the conflict list ───────────────────────────────────────────────────
  const conflicts: KoineConflict[] = []
  for (const change of p.changes) {
    const held = current[change.field]
    if (deepEqual(held, change.from)) continue // the base is intact for this field
    // Someone else moved this field too. The shape validated above, so neither
    // candidate is convicted by it: a human decides which was meant.
    conflicts.push({
      field: change.field,
      kind: 'both-intentional',
      current: held,
      base: change.from,
      proposed: change.to,
      why: 'the holder changed this field after the proposal was drafted, and both values are legal',
    })
  }
  return { status: 'ready', problems: [], conflicts, openQuestions }
}

/**
 * Does the proposal's declared `schema` name the record type it actually
 * changes, and does this tree carry it?
 *
 * The id form is the one the emitter stamps, `koine/types/<name>@v0` — so a bare
 * name is accepted too, because a producer that writes the name rather than the
 * full id is unambiguous and refusing it would be pedantry. What is refused is a
 * declaration that points somewhere else, or nowhere.
 */
function schemaIdProblem(
  schema: string,
  kind: string | undefined,
  tree: ParsedKoineTree,
): string | undefined {
  const match = /^koine\/types\/(.+?)@v\d+$/.exec(schema)
  const named = match?.[1] ?? schema
  if (kind !== undefined && named !== kind) {
    return `the proposal declares schema "${schema}" and changes a body of kind "${kind}" — one of the two is wrong`
  }
  if (recordSchemaFor(tree, named) === undefined) {
    return `the proposal declares schema "${schema}" and this tree carries no record type "${named}"`
  }
  return undefined
}

/** The record type a tree carries for a kind — free-standing, or docked onto a Kind. */
function recordSchemaFor(tree: ParsedKoineTree, kind: string): Readonly<Record<string, unknown>> | undefined {
  const record = (tree.dictionaries.records ?? []).find((r) => r.name === kind)
  if (record !== undefined) return record.schema
  return (tree.dictionaries.tags ?? []).find((t) => t.name === kind)?.shape
}

/** The field-wise difference between two shapes, keyed by field. */
function diffShapes(
  current: Readonly<Record<string, unknown>>,
  resulting: Readonly<Record<string, unknown>>,
): Map<string, { from: unknown; to: unknown }> {
  const out = new Map<string, { from: unknown; to: unknown }>()
  for (const field of new Set([...Object.keys(current), ...Object.keys(resulting)])) {
    if (!deepEqual(current[field], resulting[field])) {
      out.set(field, { from: current[field], to: resulting[field] })
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Acceptance
// ---------------------------------------------------------------------------

/** What acceptance produced: new bytes for the body, and the commit that records it. */
export interface KoineAcceptance {
  readonly path: string
  readonly bytes: string
  /** The commit to append — bound to the node it touched (§3.3), never named only in prose. */
  readonly commit: {
    readonly actor: string
    readonly what: string
    readonly why: string
    readonly when: string
    readonly node: string
  }
}

/**
 * Apply an accepted proposal to a body — SPEC §5's acceptance semantics.
 *
 * The caller re-emits the tree, which recomputes the node's `contentHash` and
 * the chain over the appended commit. History is append-only; prior values
 * remain as record, never edited.
 *
 * **The commit is bound to its node.** Before §3.3's `node` field the acceptance
 * ritual could only NAME the node in prose, which is how the binding a receiver
 * needs came to live in a field no foreign reader can tell from a sentence.
 */
export function acceptProposal(
  proposal: KoineProposal,
  /**
   * The node AS THE TREE HOLDS IT NOW — its current path and body.
   *
   * **B5b, reported 2026-09-17.** This used to take the body alone and return
   * `proposal.target.path` as the write target. An id outlives a path (§3.2), so
   * a document renamed after the proposal was drafted resolved correctly by id,
   * received `ready`, and then had its acceptance written back to the OLD path —
   * creating a stale twin and leaving the real body untouched. The parameter is
   * required rather than optional because the mistake is not a caller's
   * oversight to make: the only safe target is the one the receiver resolved.
   */
  current: { readonly path: string; readonly body: string },
  when: string,
): KoineAcceptance {
  const body = current.body
  const commit = {
    actor: proposal.proposer,
    what: proposal.changes.map((c) => c.field).join(', '),
    why: proposal.rationale,
    when,
    node: proposal.target.nodeId,
  }
  if (isBodyProposal(proposal)) {
    const change = proposal.changes[0] as KoineProposalChange
    const locator: KoineLocator = {
      contentHash: proposal.target.baseContentHash,
      ...(proposal.target.selector !== undefined ? { selector: proposal.target.selector } : {}),
    }
    const resolution = resolveLocator(locator, body, proposal.target.baseContentHash)
    if (resolution.status !== 'resolved' || resolution.region.kind !== 'text') {
      throw new Error('acceptProposal: the region no longer resolves — receive the proposal again')
    }
    const points = [...body]
    const bytes = [
      points.slice(0, resolution.region.start).join(''),
      String(change.to),
      points.slice(resolution.region.end).join(''),
    ].join('')
    return { path: current.path, bytes, commit }
  }
  return { path: current.path, bytes: applyShape(body, proposal), commit }
}

/** Rewrite the shape block's declarations to the proposal's resulting shape, leaving prose untouched. */
function applyShape(body: string, proposal: KoineProposal): string {
  const resulting = proposal.resultingShape as Record<string, unknown>
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
  if (opened === -1) throw new Error('acceptProposal: the target body carries no shape block')
  const closer = new RegExp(`^\\s*${fence[0] === '`' ? '`' : '~'}{${fence.length},}[ \\t]*$`)
  let closed = -1
  for (let i = opened + 1; i < lines.length; i++) {
    if (closer.test(lines[i] as string)) {
      closed = i
      break
    }
  }
  if (closed === -1) throw new Error('acceptProposal: the shape block is never closed')

  // Declaration ORDER is preserved for the keys that were there, and new keys
  // append — a diff a person reads should show the change, not a reshuffle.
  const existing = lines.slice(opened + 1, closed)
  const seen = new Set<string>()
  const rewritten: string[] = []
  for (const line of existing) {
    if (line.trim() === '') {
      rewritten.push(line)
      continue
    }
    const at = line.indexOf(': ')
    const key = at === -1 ? line : line.slice(0, at)
    if (!Object.hasOwn(resulting, key)) continue // removed by the proposal
    seen.add(key)
    rewritten.push(`${key}: ${render(resulting[key])}`)
  }
  for (const [key, value] of Object.entries(resulting)) {
    if (!seen.has(key)) rewritten.push(`${key}: ${render(value)}`)
  }
  return [...lines.slice(0, opened + 1), ...rewritten, ...lines.slice(closed)].join('\n')
}

/** A shape block is text (§2.2): a value goes back as the text it was coerced from. */
const render = (value: unknown): string => (typeof value === 'string' ? value : JSON.stringify(value))
