/**
 * Koine codec — the jsonl sidecars and the chain.
 *
 * Emit and parse for `.koine/nodes.jsonl`, `edges.jsonl`,
 * `history/commits.jsonl` and `history/chain.jsonl`. Emission is canonical
 * (fixed key order, compact JSON, every line `\n`-terminated) so that
 * parse → re-emit is byte-identical — the round-trip law at file grain.
 *
 * The chain algorithm is normative (SPEC §3.3): `commit` = sha256 of the exact
 * commit line bytes (UTF-8, without the terminating newline); `hash` =
 * sha256 of the ASCII concatenation `prev + commit` (lowercase hex);
 * genesis `prev` = 64 zeros.
 */

import { sha256Hex } from './sha256.js'
import {
  KoineParseError,
  type KoineChainHeader,
  type KoineChainLink,
  type KoineCommit,
  type KoineEdgeEntry,
  type KoineNodeEntry,
  type KoineVerifyResult,
} from './types.js'

export const CHAIN_FORMAT = 'koine/chain@v0'
export const CHAIN_ALGO =
  'commit = sha256(exact commit line bytes, utf-8, no trailing newline); hash = sha256(prev + commit) over the lowercase hex strings concatenated; genesis prev = 64 zeros'
export const GENESIS_PREV = '0'.repeat(64)

const jsonLine = (value: unknown): string => JSON.stringify(value)

function splitLines(file: string, text: string): string[] {
  if (text !== '' && !text.endsWith('\n')) {
    throw new KoineParseError(file, 0, 'every koine jsonl file is newline-terminated, including its last line')
  }
  return text === '' ? [] : text.slice(0, -1).split('\n')
}

function parseLine(file: string, index: number, raw: string): Record<string, unknown> {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new KoineParseError(file, index + 1, 'line is not valid JSON')
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new KoineParseError(file, index + 1, 'line is not a JSON object')
  }
  return parsed as Record<string, unknown>
}

function requireString(file: string, index: number, row: Record<string, unknown>, key: string): string {
  const value = row[key]
  if (typeof value !== 'string' || value === '') {
    throw new KoineParseError(file, index + 1, `missing or non-string field "${key}"`)
  }
  return value
}

function requireNumber(file: string, index: number, row: Record<string, unknown>, key: string): number {
  const value = row[key]
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new KoineParseError(file, index + 1, `missing or non-integer field "${key}"`)
  }
  return value
}

// ---------------------------------------------------------------------------
// nodes.jsonl
// ---------------------------------------------------------------------------

export function emitNodesJsonl(entries: readonly KoineNodeEntry[]): string {
  return entries
    .map((e) => jsonLine({ id: e.id, path: e.path, format: e.format, contentHash: e.contentHash }))
    .map((l) => `${l}\n`)
    .join('')
}

export function parseNodesJsonl(text: string): KoineNodeEntry[] {
  const file = 'nodes.jsonl'
  return splitLines(file, text).map((raw, i) => {
    const row = parseLine(file, i, raw)
    const contentHash = requireString(file, i, row, 'contentHash')
    if (!/^sha256:[0-9a-f]{64}$/.test(contentHash)) {
      throw new KoineParseError(file, i + 1, 'contentHash must be "sha256:" + 64 lowercase hex chars')
    }
    return {
      id: requireString(file, i, row, 'id'),
      path: requireString(file, i, row, 'path'),
      format: requireString(file, i, row, 'format'),
      contentHash: contentHash as KoineNodeEntry['contentHash'],
    }
  })
}

// ---------------------------------------------------------------------------
// edges.jsonl
// ---------------------------------------------------------------------------

export function emitEdgesJsonl(entries: readonly KoineEdgeEntry[]): string {
  return entries
    .map((e) => jsonLine({ from: e.from, to: e.to, type: e.type }))
    .map((l) => `${l}\n`)
    .join('')
}

export function parseEdgesJsonl(text: string): KoineEdgeEntry[] {
  const file = 'edges.jsonl'
  return splitLines(file, text).map((raw, i) => {
    const row = parseLine(file, i, raw)
    return {
      from: requireString(file, i, row, 'from'),
      to: requireString(file, i, row, 'to'),
      type: requireString(file, i, row, 'type'),
    }
  })
}

// ---------------------------------------------------------------------------
// history/commits.jsonl
// ---------------------------------------------------------------------------

export function emitCommitsJsonl(commits: readonly KoineCommit[]): string {
  return commits
    .map((c) => jsonLine({ seq: c.seq, actor: c.actor, what: c.what, why: c.why, when: c.when }))
    .map((l) => `${l}\n`)
    .join('')
}

export function parseCommitsJsonl(text: string): KoineCommit[] {
  const file = 'commits.jsonl'
  return splitLines(file, text).map((raw, i) => {
    const row = parseLine(file, i, raw)
    return {
      seq: requireNumber(file, i, row, 'seq'),
      actor: requireString(file, i, row, 'actor'),
      what: requireString(file, i, row, 'what'),
      why: requireString(file, i, row, 'why'),
      when: requireString(file, i, row, 'when'),
    }
  })
}

// ---------------------------------------------------------------------------
// history/chain.jsonl
// ---------------------------------------------------------------------------

/** Compute the Merkle chain over the exact lines of an emitted commits.jsonl. */
export async function computeChain(commitsJsonl: string): Promise<KoineChainLink[]> {
  const lines = splitLines('commits.jsonl', commitsJsonl)
  const links: KoineChainLink[] = []
  let prev = GENESIS_PREV
  for (const [i, line] of lines.entries()) {
    const commit = await sha256Hex(line)
    const hash = await sha256Hex(prev + commit)
    links.push({ seq: i + 1, commit, prev, hash })
    prev = hash
  }
  return links
}

export function emitChainJsonl(links: readonly KoineChainLink[]): string {
  const header = jsonLine({ format: CHAIN_FORMAT, algo: CHAIN_ALGO })
  const rows = links.map((l) => jsonLine({ seq: l.seq, commit: l.commit, prev: l.prev, hash: l.hash }))
  return [header, ...rows].map((l) => `${l}\n`).join('')
}

export function parseChainJsonl(text: string): { header: KoineChainHeader; links: KoineChainLink[] } {
  const file = 'chain.jsonl'
  const lines = splitLines(file, text)
  if (lines.length === 0) throw new KoineParseError(file, 0, 'chain file is empty — the header line is required')
  const headerRow = parseLine(file, 0, lines[0] as string)
  const header: KoineChainHeader = {
    format: requireString(file, 0, headerRow, 'format'),
    algo: requireString(file, 0, headerRow, 'algo'),
  }
  const links = lines.slice(1).map((raw, i) => {
    const row = parseLine(file, i + 1, raw)
    return {
      seq: requireNumber(file, i + 1, row, 'seq'),
      commit: requireString(file, i + 1, row, 'commit'),
      prev: requireString(file, i + 1, row, 'prev'),
      hash: requireString(file, i + 1, row, 'hash'),
    }
  })
  return { header, links }
}

/**
 * Recompute the chain from commit bytes and compare against the recorded links.
 * Single-copy integrity: a rewritten commit line convicts its own link (and, via
 * `prev` continuity, everything after it). A consistently rewritten tail is
 * exposed by any second holder's copy — custody, not this function.
 */
export async function verifyChain(commitsJsonl: string, chainJsonl: string): Promise<KoineVerifyResult> {
  const problems: string[] = []
  const recorded = parseChainJsonl(chainJsonl)
  const recomputed = await computeChain(commitsJsonl)
  if (recorded.links.length !== recomputed.length) {
    problems.push(`chain has ${recorded.links.length} links for ${recomputed.length} commits`)
  }
  const n = Math.min(recorded.links.length, recomputed.length)
  for (let i = 0; i < n; i++) {
    const want = recomputed[i] as KoineChainLink
    const got = recorded.links[i] as KoineChainLink
    if (got.commit !== want.commit || got.prev !== want.prev || got.hash !== want.hash) {
      problems.push(`chain seq ${got.seq}: recomputed ${want.hash} != recorded ${got.hash}`)
    }
  }
  return { ok: problems.length === 0, problems }
}
