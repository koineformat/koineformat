/**
 * Koine codec — shared types.
 *
 * The koine form is files + `.koine/` sidecars: an identity map (nodes.jsonl),
 * a typed graph slice (edges.jsonl), the type dictionaries (types/*.json) and
 * travelling history (history/commits.jsonl + history/chain.jsonl). This module
 * is pure data-shape territory: the codec takes data in and gives bytes out —
 * it never reads registries, storage, or the network.
 *
 * Normative spec: [`SPEC.md`](../SPEC.md) — §2 the dictionaries, §3 the tree profile,
 * §4 the validity gradient.
 */

/** Full-sha256 content hash, prefixed — the ONE hash at the codec boundary. */
export type KoineContentHash = `sha256:${string}`

/** One row of `.koine/nodes.jsonl` — the identity map over the floor-0 tree. */
export interface KoineNodeEntry {
  readonly id: string
  readonly path: string
  readonly format: string
  readonly contentHash: KoineContentHash
}

/** One row of `.koine/edges.jsonl` — the typed graph slice. */
export interface KoineEdgeEntry {
  readonly from: string
  readonly to: string
  readonly type: string
}

/** One row of `.koine/history/commits.jsonl` — an attributed semantic commit. */
export interface KoineCommit {
  readonly seq: number
  /** `actor:(user|agent):<id>` — attributed, not proven (proving is the signing chapter). */
  readonly actor: string
  readonly what: string
  readonly why: string
  /** ISO-8601 UTC (`Z`) — no other timezone form is valid in koine. */
  readonly when: string
}

/** One link of `.koine/history/chain.jsonl` (after the header line). */
export interface KoineChainLink {
  readonly seq: number
  /** sha256 of the exact commit line bytes (no trailing newline), lowercase hex. */
  readonly commit: string
  /** Previous link's hash; 64 zeros at genesis. */
  readonly prev: string
  /** sha256 of the ASCII concatenation `prev + commit`. */
  readonly hash: string
}

/** The declared header (line 1) of `.koine/history/chain.jsonl`. */
export interface KoineChainHeader {
  readonly format: string
  readonly algo: string
}

/** The validity gradient (SPEC §4). A body without a shape block reads as `spoken`. */
export type KoineValidity = 'spoken' | 'draft' | 'valid' | 'frozen'

/**
 * Dictionary input: a Kind, serialized to `types/<name>.tagtype.json`.
 *
 * **The shape travels as a second file, not as a facet.** SPEC §2.2 binds a body's
 * `kind:` to `types/<kind>.schema.json`, so a Kind that declares a payload shape
 * emits BOTH files: the behaviour facets here, the shape beside it under the
 * record-type filename. Without it a Kind arrives saying how it behaves and not
 * what it holds — a half-definition, which is precisely what a receiving
 * workspace cannot act on: it can install the behaviour and still not know
 * which fields a body of that Kind is allowed to carry.
 */
export interface KoineTagType {
  readonly name: string
  readonly description: string
  readonly cascade: string
  readonly proactivity: string
  readonly contentFormat: string
  /**
   * Custody — who defined this Kind, and under what seal.
   *
   * Carried verbatim as a JSON object rather than as a fixed struct, because
   * the SPEC declares no custody vocabulary and this codec has no authority to
   * invent one. A struct would either drop the facet a future seal adds or
   * write SPEC text by implication. Producers record what they know — an
   * installing connector typically records `{plugin, version}` — and a foreign
   * reader may ignore keys it does not recognize. Same carry-verbatim treatment
   * as `shape`.
   */
  readonly provenance?: Readonly<Record<string, unknown>>
  /** The payload shape, as JSON Schema. Emitted to `types/<name>.schema.json`. */
  readonly shape?: Readonly<Record<string, unknown>>
}

/** Dictionary input: a Link type, serialized to `types/<name>.edgetype.json`. */
export interface KoineEdgeType {
  readonly name: string
  readonly description: string
  /**
   * Downward propagation through the container hierarchy — the one behaviour
   * facet all three meaning-type dictionaries share, alongside name and
   * description.
   *
   * Optional here while {@link KoineTagType.cascade} is required, and
   * deliberately so: a Kind's cascade already travels in every dictionary
   * written so far, a Link type's has no producer yet — requiring it would make
   * the emitter fabricate a default it was never told. Absent means "not
   * declared", never `hot`.
   */
  readonly cascade?: string
  readonly directed: boolean
  readonly transitive: boolean
  readonly weight: string
}

/**
 * Dictionary input: a Record type — a JSON Schema, serialized to `types/<name>.schema.json`.
 *
 * **No top-level storage facets, by decision.** A Record type's declarable
 * group (cascade · profile · version · display names · icon) does NOT become
 * sibling keys beside `schema`; it rides INSIDE the schema document under a
 * vendor extension prefix (`x-…`), which a foreign reader may ignore by the
 * ordinary JSON Schema rule. One file shape then serves both producers of
 * `types/<name>.schema.json` — a free-standing Record type and a Kind's payload
 * shape — and `schema` stays carried verbatim.
 *
 * A producer adopting that route should know it is an EXTENSION, not a reuse:
 * in the reference implementation the `x-` extension keys carry field-level
 * concerns (entry and actor references, rollups, reminders, signals), while
 * `cascade` lives outside the schema document entirely, as its own storage
 * column. Note too that a `provenance` extension key inside a schema states
 * what the schema was derived FROM — not the install trail
 * {@link KoineTagType.provenance} carries. One word, two subjects.
 */
export interface KoineRecordType {
  readonly name: string
  readonly schema: Readonly<Record<string, unknown>>
}

/** The type dictionaries travelling inside a koine repo (its grammar chapter). */
export interface KoineTypeSet {
  readonly records?: readonly KoineRecordType[]
  readonly tags?: readonly KoineTagType[]
  readonly edges?: readonly KoineEdgeType[]
}

/** One floor-0 body going into `emitKoineTree` — bytes plus declared identity. */
export interface KoineTreeNodeInput {
  readonly id: string
  readonly path: string
  readonly format: string
  readonly bytes: Uint8Array | string
  /** Position on the validity gradient; absent reads as `spoken` (SPEC §4). */
  readonly state?: KoineValidity
}

/** Everything `emitKoineTree` accepts. SPEC Law 4's exclusions are typed away: there is no field for membership, permissions, presence, secrets or pending proposals. */
export interface KoineTreeInput {
  readonly nodes: readonly KoineTreeNodeInput[]
  readonly edges?: readonly KoineEdgeEntry[]
  readonly commits?: readonly KoineCommit[]
  readonly types?: KoineTypeSet
}

/** Emit options. `frozenSlice` applies the travel law (SPEC §4 rule 4). */
export interface KoineEmitOptions {
  /** Only `valid`/`frozen` nodes enter; edges are filtered to surviving endpoints. */
  readonly frozenSlice?: boolean
}

/** What `parseKoineTree` returns — the codec's read side. */
export interface ParsedKoineTree {
  readonly nodes: readonly KoineNodeEntry[]
  readonly edges: readonly KoineEdgeEntry[]
  readonly commits: readonly KoineCommit[]
  readonly chain: { readonly header: KoineChainHeader; readonly links: readonly KoineChainLink[] } | undefined
  /**
   * types/<filename> → parsed JSON object, verbatim. Kept raw because
   * byte-identical re-emit needs the original keys, including any a future
   * SPEC revision adds that this codec does not know.
   */
  readonly types: ReadonlyMap<string, Readonly<Record<string, unknown>>>
  /**
   * The same dictionaries, typed — the read side's counterpart to
   * `KoineTreeInput.types`. A reader of a foreign tree gets a grammar it can
   * use instead of raw JSON it must re-type itself.
   */
  readonly dictionaries: KoineTypeSet
  /** Every non-`.koine/` file, verbatim. */
  readonly bodies: ReadonlyMap<string, Uint8Array | string>
}

/** Verification verdict for a parsed or on-disk tree. */
export interface KoineVerifyResult {
  readonly ok: boolean
  readonly problems: readonly string[]
}

/** Raised when sidecar bytes do not parse as the koine form. */
export class KoineParseError extends Error {
  override readonly name = 'KoineParseError'
  constructor(
    readonly file: string,
    readonly line: number,
    readonly problem: string,
  ) {
    super(`${file}:${line} — ${problem}`)
  }
}

/** Raised when an emit input violates the form (reserved path, dangling edge, duplicate id/path). */
export class KoineEmitError extends Error {
  override readonly name = 'KoineEmitError'
}
