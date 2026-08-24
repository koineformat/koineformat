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
  type KoineEdgeType,
  type KoineEmitOptions,
  type KoineNodeEntry,
  type KoineRecordType,
  type KoineTagType,
  type KoineTreeInput,
  type KoineTypeSet,
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

/** Travel law: which states enter a frozen slice. */
const TRAVELS_FROZEN = new Set(['valid', 'frozen'])

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

  // Travel law: only valid/frozen enter a frozen slice; absent state reads
  // as `spoken` and stays home. The living clone carries every state.
  const nodes = options.frozenSlice
    ? input.nodes.filter((n) => TRAVELS_FROZEN.has(n.state ?? 'spoken'))
    : [...input.nodes]

  const survivingIds = new Set(nodes.map((n) => n.id))
  const edges = (input.edges ?? []).filter((e) => {
    const bothSurvive = survivingIds.has(e.from) && survivingIds.has(e.to)
    if (!bothSurvive && !options.frozenSlice) {
      throw new KoineEmitError(`edge ${e.from} -> ${e.to} references a node not in the tree`)
    }
    return bothSurvive
  })

  const files = new Map<string, Uint8Array | string>()

  const entries: KoineNodeEntry[] = []
  for (const node of nodes) {
    files.set(node.path, node.bytes)
    const hash = await sha256Hex(toBytes(node.bytes))
    entries.push({ id: node.id, path: node.path, format: node.format, contentHash: `sha256:${hash}` })
  }
  files.set(NODES_PATH, emitNodesJsonl(entries))

  if (input.edges !== undefined) files.set(EDGES_PATH, emitEdgesJsonl(edges))

  if (input.commits !== undefined) {
    const commitsJsonl = emitCommitsJsonl(input.commits)
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

  return files
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

/** Recompute every node hash and the full chain — floors 1 and 2, mechanically. */
export async function verifyKoineTree(files: ReadonlyMap<string, Uint8Array | string>): Promise<KoineVerifyResult> {
  const problems: string[] = []
  let tree: ParsedKoineTree
  try {
    tree = parseKoineTree(files)
  } catch (error) {
    return { ok: false, problems: [error instanceof Error ? error.message : String(error)] }
  }

  for (const node of tree.nodes) {
    const body = files.get(node.path)
    if (body === undefined) {
      problems.push(`node ${node.id}: path "${node.path}" is missing from the tree`)
      continue
    }
    const actual = `sha256:${await sha256Hex(toBytes(body))}`
    if (actual !== node.contentHash) {
      problems.push(`node ${node.id} (${node.path}): ${actual} != ${node.contentHash}`)
    }
  }

  const ids = new Set(tree.nodes.map((n) => n.id))
  for (const edge of tree.edges) {
    if (!ids.has(edge.from) || !ids.has(edge.to)) {
      problems.push(`edge ${edge.from} -> ${edge.to} references a node not in the identity map`)
    }
  }

  if (tree.chain !== undefined) {
    const commitsText = textOf(files.get(`${KOINE_DIR}/history/commits.jsonl`) as Uint8Array | string)
    const chainText = textOf(files.get(`${KOINE_DIR}/history/chain.jsonl`) as Uint8Array | string)
    const chainVerdict = await verifyChain(commitsText, chainText)
    problems.push(...chainVerdict.problems)
  }

  return { ok: problems.length === 0, problems }
}
