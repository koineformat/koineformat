/**
 * Koine codec — the one pair: `emitKoineTree` / `parseKoineTree`.
 *
 * Emit takes bodies + declared identity and produces the complete koine file
 * map (bodies verbatim — sidecar, never frontmatter — plus `.koine/*`).
 * Parse is its inverse. `verifyKoineTree` recomputes every content hash and
 * the full chain — the TypeScript sibling of the reference verifier.
 *
 * The travel law (SPEC §4 rule 4) and SPEC Law 4's exclusions are enforced
 * HERE, at the one chokepoint — never per caller.
 */

import { sha256Hex } from './sha256.js'
import { resolveLocator } from './locator.js'
import { isShapeProblem, readShapeBlock } from './shape.js'
import { coerceShapeValues, validateAgainstSchema } from './schema.js'
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
} from './dictionaries.js'
import {
  computeChain,
  emitChainJsonl,
  emitCommitsJsonl,
  emitEdgesJsonl,
  emitNodesJsonl,
  parseChainJsonl,
  parseCommitsJsonl,
  parseEdgesJsonl,
  parseNodesJsonl,
  verifyChain,
} from './sidecars.js'
import {
  KoineEmitError,
  KoineParseError,
  type KoineCommit,
  type KoineContentHash,
  type KoineEdgeType,
  type KoineEmitOptions,
  type KoineNodeEntry,
  type KoineRecordType,
  type KoineTagType,
  type KoineTreeInput,
  type KoineTreeNodeInput,
  type KoineTypeSet,
  type KoineValidity,
  type KoineVerdict,
  type KoineVerifyResult,
  type ParsedKoineTree,
} from './types.js'

export const KOINE_DIR = '.koine'

const NODES_PATH = `${KOINE_DIR}/nodes.jsonl`
const EDGES_PATH = `${KOINE_DIR}/edges.jsonl`
const COMMITS_PATH = `${KOINE_DIR}/history/commits.jsonl`
const CHAIN_PATH = `${KOINE_DIR}/history/chain.jsonl`
const TYPES_PREFIX = `${KOINE_DIR}/types/`

const utf8 = new TextEncoder()

const toBytes = (value: Uint8Array | string): Uint8Array => (typeof value === 'string' ? utf8.encode(value) : value)

const textOf = (value: Uint8Array | string): string => (typeof value === 'string' ? value : new TextDecoder().decode(value))

/**
 * A body's text, or `undefined` when it is not UTF-8 text at all.
 *
 * A binary body carries no shape block by construction; decoding it leniently
 * would produce replacement characters and a confident wrong answer, so the
 * strict decoder's failure IS the classification.
 */
function textIfText(value: Uint8Array | string): string | undefined {
  if (typeof value === 'string') return value
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(value)
  } catch {
    return undefined
  }
}

/**
 * The travel law (SPEC §4 rule 4), and the distinction the codec used to lose.
 *
 * A body that DECLARES a state below `valid` is gated out — that is the gate's
 * whole job. A body that declares NO state is outside the gate: it travels as
 * the utterance it is, and packaging does not promote it (§7.6).
 *
 * The old reading was `TRAVELS.has(state ?? 'spoken')`, which collapsed those
 * two into one and made a frozen slice of an undeclared tree yield zero nodes —
 * a codec contradicting the specification it implements, with the roundtrip
 * test green over it because the test re-emitted the original input.
 */
const travelsInFrozenSlice = (state: KoineValidity | undefined): boolean =>
  state === undefined || state === 'valid' || state === 'frozen'

/**
 * The state that travels for one body: the shape block's declaration if it has
 * one, otherwise what the producer told us.
 *
 * A producer contradicting its own body is an error rather than a silent pick.
 * A promotion that never reached the body is exactly the defect §4 rule 1
 * exists to make visible, and choosing a winner here would bury it.
 */
function resolveState(node: KoineTreeNodeInput): KoineValidity | undefined {
  const text = textIfText(node.bytes)
  const block = text === undefined ? undefined : readShapeBlock(text)
  if (block === undefined || isShapeProblem(block)) return node.state
  if (block.state === undefined) return node.state
  if (node.state !== undefined && node.state !== block.state) {
    throw new KoineEmitError(
      `node "${node.id}" (${node.path}) is declared "${node.state}" by its producer and "${block.state}" by its own `
      + 'shape block — promote the body, or stop asserting a state it does not carry (SPEC §4 rule 1)',
    )
  }
  return block.state
}

export async function emitKoineTree(
  input: KoineTreeInput,
  options: KoineEmitOptions = {},
): Promise<Map<string, Uint8Array | string>> {
  const seenIds = new Set<string>()
  const seenPaths = new Set<string>()
  for (const node of input.nodes) {
    if (node.path.startsWith(`${KOINE_DIR}/`) || node.path === KOINE_DIR) {
      throw new KoineEmitError(`node path "${node.path}" is inside the reserved ${KOINE_DIR}/ sidecar directory`)
    }
    if (seenIds.has(node.id)) throw new KoineEmitError(`duplicate node id "${node.id}"`)
    if (seenPaths.has(node.path)) throw new KoineEmitError(`duplicate node path "${node.path}"`)
    seenIds.add(node.id)
    seenPaths.add(node.path)
  }

  // The state each body carries into the tree, resolved ONCE: the shape block
  // is the declaration (§4), the producer's field answers only where the body
  // is silent, and a contradiction between them is an error.
  const states = new Map<string, KoineValidity | undefined>()
  for (const node of input.nodes) states.set(node.id, resolveState(node))

  // Travel law (§4 rule 4 · §7.6): a DECLARED state below `valid` is gated out;
  // an undeclared body travels as the utterance it is. The living clone carries
  // every state.
  const nodes = options.frozenSlice
    ? input.nodes.filter((n) => travelsInFrozenSlice(states.get(n.id)))
    : [...input.nodes]

  const survivingIds = new Set(nodes.map((n) => n.id))
  const excludedIds = input.nodes.map((n) => n.id).filter((id) => !survivingIds.has(id))
  const edges = (input.edges ?? []).filter((e) => {
    const bothSurvive = survivingIds.has(e.from) && survivingIds.has(e.to)
    if (!bothSurvive && !options.frozenSlice) {
      throw new KoineEmitError(`edge ${e.from} -> ${e.to} references a node not in the tree`)
    }
    return bothSurvive
  })

  // A frozen slice is a COMPLETE artifact over the surviving set, not a tree
  // with its nodes list shortened. History about an excluded body does not
  // travel — a slice that filtered its nodes and shipped the commits verbatim
  // would carry, in prose, exactly the thinking the gate refused.
  const commits = options.frozenSlice
    ? (input.commits ?? [])
        .filter((c) => c.node === undefined || survivingIds.has(c.node))
        // The slice's history is its own: renumbered from 1 so that no gap in
        // `seq` reports how much was withheld, and so the chain it carries is
        // verifiable rather than a chain with holes in it.
        .map((c, i): KoineCommit => ({ ...c, seq: i + 1 }))
    : input.commits

  const files = new Map<string, Uint8Array | string>()

  const entries: KoineNodeEntry[] = []
  for (const node of nodes) {
    files.set(node.path, node.bytes)
    const hash = await sha256Hex(toBytes(node.bytes))
    const state = states.get(node.id)
    entries.push({
      id: node.id,
      path: node.path,
      format: node.format,
      contentHash: `sha256:${hash}`,
      ...(state !== undefined ? { state } : {}),
    })
  }
  files.set(NODES_PATH, emitNodesJsonl(entries))

  if (input.edges !== undefined) files.set(EDGES_PATH, emitEdgesJsonl(edges))

  if (commits !== undefined) {
    const commitsJsonl = emitCommitsJsonl(commits)
    files.set(COMMITS_PATH, commitsJsonl)
    files.set(CHAIN_PATH, emitChainJsonl(await computeChain(commitsJsonl)))
  }

  // `types/<name>.schema.json` has two producers — a Record type IS a schema,
  // and a Kind's payload shape resolves to the same filename under SPEC §2.2's
  // `kind:` binding. Same name from both sides is a genuine ambiguity in the
  // tree (which definition does a body's `kind:` resolve to?), so it is
  // rejected rather than won by write order.
  const schemaFileOwner = new Map<string, 'record type' | 'kind shape'>()
  const claimSchemaFile = (name: string, owner: 'record type' | 'kind shape'): void => {
    const held = schemaFileOwner.get(name)
    if (held !== undefined) {
      throw new KoineEmitError(
        `types/${name}.schema.json is claimed by both a ${held} and a ${owner} — `
        + 'one name cannot resolve to two definitions',
      )
    }
    schemaFileOwner.set(name, owner)
  }

  for (const record of input.types?.records ?? []) {
    claimSchemaFile(record.name, 'record type')
    files.set(`${KOINE_DIR}/${recordTypePath(record.name)}`, emitRecordTypeJson(record))
  }
  for (const tag of input.types?.tags ?? []) {
    files.set(`${KOINE_DIR}/${tagTypePath(tag.name)}`, emitTagTypeJson(tag))
    if (tag.shape !== undefined) {
      claimSchemaFile(tag.name, 'kind shape')
      files.set(
        `${KOINE_DIR}/${recordTypePath(tag.name)}`,
        emitRecordTypeJson({ name: tag.name, schema: tag.shape }),
      )
    }
  }
  for (const edge of input.types?.edges ?? []) {
    files.set(`${KOINE_DIR}/${edgeTypePath(edge.name)}`, emitEdgeTypeJson(edge))
  }

  // A Locator that does not match the body it addresses is a broken pointer,
  // and it is broken at the moment it is written — not at the moment someone
  // tries to follow it.
  const hashById = new Map(entries.map((e) => [e.id, e.contentHash]))
  for (const edge of edges) {
    for (const [end, id, locator] of [
      ['from', edge.from, edge.fromLocator],
      ['to', edge.to, edge.toLocator],
    ] as const) {
      if (locator === undefined) continue
      const actual = hashById.get(id)
      if (actual !== undefined && actual !== locator.contentHash) {
        throw new KoineEmitError(
          `edge ${edge.from} -> ${edge.to}: its ${end} Locator addresses ${locator.contentHash}, and node "${id}" `
          + `is ${actual} — re-anchor the Locator against the body it means, or the pointer ships already rotten`,
        )
      }
    }
  }

  // The last law of a frozen slice: nothing that travels may NAME something
  // that did not. Filtering the node list while a commit's prose or a
  // dictionary still spells an excluded id is redaction that redacts nothing.
  if (options.frozenSlice && excludedIds.length > 0) {
    for (const [path, content] of files) {
      if (!path.startsWith(`${KOINE_DIR}/`)) continue
      const text = textOf(content)
      for (const id of excludedIds) {
        if (namesId(text, id)) {
          throw new KoineEmitError(
            `${path} names "${id}", which the travel law kept out of this frozen slice — `
            + 'a slice that withholds a body and keeps talking about it has redacted nothing',
          )
        }
      }
    }
  }

  return files
}

/**
 * Does this text name that id?
 *
 * Substring alone is wrong — an excluded `n-1` would convict a surviving
 * `n-12` — so the match is bounded by the characters an id is built from. No id
 * scheme is prescribed (§3.2), which is why the boundary is a character class
 * rather than a parse.
 */
function namesId(text: string, id: string): boolean {
  const idChar = /[A-Za-z0-9_-]/
  let at = text.indexOf(id)
  while (at !== -1) {
    const before = at === 0 ? '' : (text[at - 1] as string)
    const afterAt = at + id.length
    const after = afterAt >= text.length ? '' : (text[afterAt] as string)
    if (!idChar.test(before) && !idChar.test(after)) return true
    at = text.indexOf(id, at + 1)
  }
  return false
}

export function parseKoineTree(files: ReadonlyMap<string, Uint8Array | string>): ParsedKoineTree {
  const nodesText = files.get(NODES_PATH)
  if (nodesText === undefined) throw new KoineParseError(NODES_PATH, 0, 'missing identity map')

  const commitsText = files.get(COMMITS_PATH)
  const chainText = files.get(CHAIN_PATH)
  if ((commitsText === undefined) !== (chainText === undefined)) {
    throw new KoineParseError(CHAIN_PATH, 0, 'commits.jsonl and chain.jsonl travel together or not at all')
  }

  const types = new Map<string, Readonly<Record<string, unknown>>>()
  const bodies = new Map<string, Uint8Array | string>()
  for (const [path, content] of files) {
    if (path.startsWith(TYPES_PREFIX)) {
      const name = path.slice(TYPES_PREFIX.length)
      let parsed: unknown
      try {
        parsed = JSON.parse(textOf(content))
      } catch {
        throw new KoineParseError(path, 1, 'type dictionary file is not valid JSON')
      }
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new KoineParseError(path, 1, 'type dictionary file is not a JSON object')
      }
      types.set(name, parsed as Record<string, unknown>)
    } else if (!path.startsWith(`${KOINE_DIR}/`)) {
      bodies.set(path, content)
    }
  }

  return {
    nodes: parseNodesJsonl(textOf(nodesText)),
    edges: files.has(EDGES_PATH) ? parseEdgesJsonl(textOf(files.get(EDGES_PATH) as Uint8Array | string)) : [],
    commits: commitsText === undefined ? [] : parseCommitsJsonl(textOf(commitsText)),
    chain: chainText === undefined ? undefined : parseChainJsonl(textOf(chainText)),
    types,
    dictionaries: readDictionaries(types),
    bodies,
  }
}

/**
 * Turn the raw `types/*` map into the typed grammar. Suffix-dispatched, because
 * the filename IS the declaration of which dictionary an entry belongs to.
 *
 * A `.schema.json` beside a `.tagtype.json` of the same name is the Kind's own
 * payload shape (SPEC §2.2), so it docks onto that Kind instead of being reported
 * as a free-standing Record type — the exact inverse of the emit above.
 */
export function readDictionaries(
  types: ReadonlyMap<string, Readonly<Record<string, unknown>>>,
): KoineTypeSet {
  const tags: KoineTagType[] = []
  const edges: KoineEdgeType[] = []
  const records: KoineRecordType[] = []
  const kindNames = new Set<string>()

  for (const [file, raw] of types) {
    if (file.endsWith('.tagtype.json')) {
      kindNames.add(file.slice(0, -'.tagtype.json'.length))
      tags.push(parseTagTypeJson(file, raw))
    } else if (file.endsWith('.edgetype.json')) {
      edges.push(parseEdgeTypeJson(file, raw))
    }
  }

  for (const [file, raw] of types) {
    if (!file.endsWith('.schema.json')) continue
    const name = file.slice(0, -'.schema.json'.length)
    if (kindNames.has(name)) continue // docked below, not a free-standing record type
    records.push(parseRecordTypeJson(name, raw))
  }

  const docked = tags.map((tag) => {
    const shapeFile = types.get(`${tag.name}.schema.json`)
    return shapeFile === undefined
      ? tag
      : { ...tag, shape: parseRecordTypeJson(tag.name, shapeFile).schema }
  })

  return { tags: docked, edges, records }
}

const verdict = (problems: readonly string[]): KoineVerdict => ({
  status: problems.length === 0 ? 'pass' : 'fail',
  problems,
})

/**
 * Verify a tree — **four questions, answered separately**.
 *
 * *integrity* (every hash and the chain) · *schema* (every body against the
 * record type it declares itself to be) · *references* (every edge, commit and
 * Locator naming something that exists, at the version it says) · *origin*
 * (who vouches — `not-established` until chapter 6's seal ships).
 *
 * One boolean over four questions cannot be acted on, and two of the four had
 * no implementation at all: nothing ever opened a body against the dictionary
 * the tree itself carries, so a verified tree could hold a body that
 * contradicts its own declared type; and a tree with no seal reported the same
 * `true` a sealed one did.
 */
export async function verifyKoineTree(files: ReadonlyMap<string, Uint8Array | string>): Promise<KoineVerifyResult> {
  let tree: ParsedKoineTree
  try {
    tree = parseKoineTree(files)
  } catch (error) {
    const problem = error instanceof Error ? error.message : String(error)
    // The tree does not parse, so no question below can be asked of it — and
    // saying `pass` to any of them would be the exact dishonesty this shape
    // exists to end.
    const unknown: KoineVerdict = { status: 'not-established', problems: ['the tree does not parse'] }
    return {
      ok: false,
      problems: [problem],
      integrity: { status: 'fail', problems: [problem] },
      schema: unknown,
      references: unknown,
      origin: unknown,
    }
  }

  // ── integrity: the bytes are what the identity map says, and history holds ──
  const integrity: string[] = []
  const hashByPath = new Map<string, KoineContentHash>()
  for (const node of tree.nodes) {
    const body = files.get(node.path)
    if (body === undefined) {
      integrity.push(`node ${node.id}: path "${node.path}" is missing from the tree`)
      continue
    }
    const actual: KoineContentHash = `sha256:${await sha256Hex(toBytes(body))}`
    hashByPath.set(node.path, actual)
    if (actual !== node.contentHash) {
      integrity.push(`node ${node.id} (${node.path}): ${actual} != ${node.contentHash}`)
    }
  }
  if (tree.chain !== undefined) {
    const commitsText = textOf(files.get(COMMITS_PATH) as Uint8Array | string)
    const chainText = textOf(files.get(CHAIN_PATH) as Uint8Array | string)
    integrity.push(...(await verifyChain(commitsText, chainText)).problems)
  }

  // ── references: everything named exists, at the version it claims ──────────
  const references: string[] = []
  const byId = new Map(tree.nodes.map((n) => [n.id, n]))
  for (const edge of tree.edges) {
    if (!byId.has(edge.from) || !byId.has(edge.to)) {
      references.push(`edge ${edge.from} -> ${edge.to} references a node not in the identity map`)
      continue
    }
    for (const [end, id, locator] of [
      ['from', edge.from, edge.fromLocator],
      ['to', edge.to, edge.toLocator],
    ] as const) {
      if (locator === undefined) continue
      const node = byId.get(id) as KoineNodeEntry
      const body = files.get(node.path)
      if (body === undefined) continue // already reported by integrity
      const resolution = resolveLocator(locator, body, hashByPath.get(node.path) as KoineContentHash)
      if (resolution.status === 'stale') {
        references.push(
          `edge ${edge.from} -> ${edge.to}: its ${end} Locator was taken against ${resolution.expected}, `
          + `and node "${id}" is ${resolution.actual} — the pointer addresses a version this tree does not hold`,
        )
      } else if (resolution.status === 'not-found') {
        references.push(`edge ${edge.from} -> ${edge.to}: its ${end} Locator reaches nothing — ${resolution.reason}`)
      }
    }
  }
  for (const commit of tree.commits) {
    if (commit.node !== undefined && !byId.has(commit.node)) {
      references.push(`commit ${commit.seq} names node "${commit.node}", which is not in the identity map`)
    }
  }

  // ── schema: a body holds what it declares itself to hold ───────────────────
  const { problems: schema, checked } = verifySchemas(tree, files)

  // ── origin: who vouches for this ───────────────────────────────────────────
  // The seal is chapter 6 and its payload enumeration is a declared gap. Until
  // it ships this answer is `not-established` — and saying so is the point: a
  // reader that cannot tell "nobody checked" from "checked and fine" has no
  // origin verdict at all, it has the absence of one wearing a passing face.
  const origin: KoineVerdict = {
    status: 'not-established',
    problems: ['no seal travels with this tree — origin is unproven, which is not the same as unsound (SPEC §6.2)'],
  }

  const problems = [...integrity, ...schema, ...references]
  return {
    ok: problems.length === 0,
    problems,
    integrity: verdict(integrity),
    // Nothing declared itself, so nothing was checked — and that is a third
    // answer, not a pass. A tree of plain utterances has no schema verdict to
    // give, and claiming one would be the same lie as a `null` origin.
    schema:
      schema.length === 0 && checked === 0
        ? { status: 'not-established', problems: ['no body in this tree declares a record type'] }
        : verdict(schema),
    references: verdict(references),
    origin,
  }
}

/**
 * Every body that declares a shape block, checked against the record type it
 * names — SPEC §2.2's *"the parsed block MUST validate against it"*, which had
 * no implementation on either side of the boundary until now.
 *
 * The state agreement rides here too: the identity map's `state` is a copy of
 * the body's declaration, and a copy that has drifted from its original is a
 * body claiming one thing and travelling as another.
 */
function verifySchemas(
  tree: ParsedKoineTree,
  files: ReadonlyMap<string, Uint8Array | string>,
): { problems: string[]; checked: number } {
  const problems: string[] = []
  let checked = 0
  const records = new Map((tree.dictionaries.records ?? []).map((r) => [r.name, r.schema]))
  for (const tag of tree.dictionaries.tags ?? []) {
    if (tag.shape !== undefined) records.set(tag.name, tag.shape)
  }

  for (const node of tree.nodes) {
    const body = files.get(node.path)
    if (body === undefined) continue // integrity's problem, not this one
    const text = textIfText(body)
    if (text === undefined) continue // a binary body carries no shape block
    // A body with no shape block carries no declaration, and the identity map
    // is then the state's ONLY home — which is right and common: most bodies
    // are not definitions, and a producer whose gradient lives in a column must
    // not be made to inject shape blocks into plain prose to export it.
    const block = readShapeBlock(text)
    if (block === undefined) continue
    if (isShapeProblem(block)) {
      problems.push(`node ${node.id} (${node.path}): ${block.problem}`)
      continue
    }
    // Where a body DOES declare a state, the map is a copy of that declaration
    // and a copy that disagrees — including one that dropped it — is a body
    // claiming one thing and travelling as another.
    if (block.state !== undefined && block.state !== node.state) {
      problems.push(
        `node ${node.id} (${node.path}) travels as ${node.state ?? 'undeclared'} and its shape block declares `
        + `${block.state} — one body cannot be in two states`,
      )
    }
    const schema = records.get(block.kind)
    if (schema === undefined) {
      problems.push(
        `node ${node.id} (${node.path}) declares "kind: ${block.kind}", and this tree carries no such record type`,
      )
      continue
    }
    checked++
    // The WHOLE block is the instance — `kind` and `state` included. They are
    // declarations like any other and a record type may constrain them (the
    // shipped `metric-definition` pins `kind` with `const` and `state` with an
    // `enum`, and requires both). A schema that closes itself with
    // `additionalProperties: false` therefore has to admit them; §2.2 says so
    // rather than the codec quietly hiding two keys from the validator.
    problems.push(
      ...validateAgainstSchema(coerceShapeValues(block.declarations, schema), schema).map(
        (problem) => `node ${node.id} (${node.path}): ${problem}`,
      ),
    )
  }
  return { problems, checked }
}
