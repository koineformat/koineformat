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
  /**
   * The body's position on the validity gradient (SPEC §4), as declared by its
   * shape block.
   *
   * **Absent is not `spoken`.** A body that declares no state is outside the
   * gradient's gate and travels as the utterance it is (§4 rule 4, §7.6); a
   * body that declares `spoken` has declared a state below `valid` and is
   * gated out of a frozen slice. Collapsing the two is the reading that made
   * this codec contradict its own specification, so the field is optional and
   * the absence is meaningful.
   *
   * Validity is declared in the body and TRAVELS here: a receiver cannot be
   * asked to parse every format in the world to learn whether a body may be
   * republished, and a law enforced only at emit time is a call parameter
   * rather than a law.
   */
  readonly state?: KoineValidity
}

/**
 * One row of `.koine/edges.jsonl` — the typed graph slice.
 *
 * `from`/`to` are node ids and stay so: an endpoint's *identity* is the node,
 * and a reader that understands nothing below stays correct. The optional
 * facets below are additive in the two ways SPEC §3.2 and §3.4 declare them —
 * where the endpoint lands (the Locator) and what makes an assertion one.
 */
export interface KoineEdgeEntry {
  readonly from: string
  readonly to: string
  readonly type: string
  /** Where in the `from` body this end lands, and against which version (§3.4). */
  readonly fromLocator?: KoineLocator
  /** Where in the `to` body this end lands, and against which version (§3.4). */
  readonly toLocator?: KoineLocator
  /**
   * Who asserted this edge — `actor:(user|agent):<id>`, the same spelling
   * `commits.jsonl` uses. An assertion without an asserter is not one.
   */
  readonly actor?: string
  /** When it was asserted. ISO-8601 UTC (`Z`), as everywhere in koine. */
  readonly when?: string
  /** Start of the interval the assertion is held to be true. ISO-8601 UTC (`Z`). */
  readonly validFrom?: string
  /** End of that interval; absent means still held. ISO-8601 UTC (`Z`). */
  readonly validTo?: string
  /**
   * The strength of the relation — the instance carrier for the `weight`
   * *semantics* its Link type declares (§2.1).
   *
   * A dictionary facet with no instance carrier is a half-law: meaning that can
   * never be exercised. The dictionary says what a weight MEANS, this says what
   * it IS; removing the declared meaning to match a missing field would have
   * been the other repair, and it is never the right one.
   */
  readonly weight?: number
}

/** One row of `.koine/history/commits.jsonl` — an attributed semantic commit. */
export interface KoineCommit {
  readonly seq: number
  /** `actor:(user|agent):<id>` — attributed, not proven (proving is the signing chapter). */
  readonly actor: string
  /**
   * What changed, in prose, for a human reading the history.
   *
   * **Prose, and never parsed as an identifier.** A producer that needs to say
   * which node a commit touched says it in {@link KoineCommit.node}; putting an
   * id here expresses a machine-readable binding in a field no foreign reader
   * can tell from a sentence.
   */
  readonly what: string
  readonly why: string
  /** ISO-8601 UTC (`Z`) — no other timezone form is valid in koine. */
  readonly when: string
  /**
   * The node this commit touched, by id — the declared binding between history
   * and the identity map (§3.3).
   *
   * Absent means the commit is about the tree rather than about one body (a
   * release, a rename sweep, a dictionary change). A commit touching several
   * bodies is several commits: the field is single so that the frozen-slice
   * filter has one unambiguous question to ask of it.
   */
  readonly node?: string
}

/**
 * A Locator — where an endpoint lands inside a body, and which version it
 * landed in (SPEC §3.4).
 *
 * `contentHash` is required. Without it a pointer rots silently: the body is
 * replaced, the pointer still resolves, and it now names something else. With
 * it a receiver can answer *"this was taken against a version you no longer
 * hold"* — the honest answer, and the one no anchor standard in the field can
 * give today.
 *
 * `selector` is optional: a Locator with none addresses the whole of that
 * version, which is a version-pinned whole-node reference.
 */
export interface KoineLocator {
  readonly contentHash: KoineContentHash
  readonly selector?: KoineSelector
}

/**
 * The closed selector vocabulary (SPEC §3.4) — six types, each taken from the
 * field rather than invented, each measured against a format knowledge actually
 * travels in.
 *
 * Closed on purpose: a reader that silently ignored an address it did not
 * understand would read *"supports page 14"* as *"supports the document"* —
 * a widening dressed as compatibility. Widening the vocabulary is a spec
 * revision, never a vendor extension.
 */
export type KoineSelector =
  /**
   * A quoted string with optional context — W3C Web Annotation's
   * `TextQuoteSelector`. The one selector that survives an edit to the body,
   * because it re-anchors by search rather than by offset.
   */
  | { readonly type: 'text-quote'; readonly exact: string; readonly prefix?: string; readonly suffix?: string }
  /**
   * A half-open span in **Unicode code points** — W3C Web Annotation's
   * `TextPositionSelector`. Exact, and brittle by nature: any edit before the
   * region shifts it, which is precisely what the Locator's `contentHash`
   * convicts.
   */
  | { readonly type: 'text-position'; readonly start: number; readonly end: number }
  /**
   * A line range, **1-based and inclusive**. The concept is RFC 5147's
   * `#line=` fragment; the indexing is declared here rather than inherited,
   * because every face that shows a person a line number counts from one.
   * `end` absent means the single line `start`.
   */
  | { readonly type: 'line-range'; readonly start: number; readonly end?: number }
  /** A 1-based page — the only address a PDF's readers agree on. */
  | { readonly type: 'page'; readonly number: number }
  /**
   * An interval in seconds — W3C Media Fragments' `#t=`. `end` absent means
   * an instant.
   */
  | { readonly type: 'time-range'; readonly start: number; readonly end?: number }
  /**
   * An RFC 6901 JSON Pointer — how a table cell, a record field and a shape
   * block declaration get addressed at all. The one selector that survives
   * reformatting, and the one that breaks on a renamed key.
   */
  | { readonly type: 'json-pointer'; readonly pointer: string }

/** A parsed shape block (SPEC §2.2) — the declaration a definition carries in its own body. */
export interface KoineShapeBlock {
  /** The record type this body declares itself to be. Required by §2.2. */
  readonly kind: string
  /** The declared position on the gradient, if the block declares one. */
  readonly state?: KoineValidity
  /** Every declaration in the block, in source order — `kind` and `state` included. */
  readonly declarations: ReadonlyMap<string, string>
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
  /**
   * Position on the validity gradient, for a producer whose state does not live
   * in the body — a database column, say.
   *
   * **The body wins.** A body carrying a shape block DECLARES its state (§4),
   * and that declaration is what travels; this field answers only for bodies
   * that declare none. A struct that contradicts its own body is an emit error
   * rather than a silent pick, because a promotion that never reached the body
   * is exactly the defect §4 rule 1 exists to make visible.
   *
   * Absent here and absent in the body means the body declares no state — NOT
   * that it declares `spoken`. See {@link KoineNodeEntry.state}.
   */
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

/**
 * One of verify's four questions.
 *
 * `not-established` is neither pass nor fail and is the answer the form owed
 * itself: *nothing here was checked*. A `null` or a silent `true` in its place
 * is indistinguishable, at every call site, from a check that ran and passed.
 */
export interface KoineVerdict {
  readonly status: 'pass' | 'fail' | 'not-established'
  readonly problems: readonly string[]
}

/**
 * Verification verdict for a parsed or on-disk tree — **four questions, four
 * answers**.
 *
 * One boolean over four unrelated questions cannot be acted on: a tree whose
 * bytes are intact and whose bodies contradict their own record types is not
 * the same artifact as one whose chain is broken, and a reader that gets `false`
 * for both has to re-derive which it holds.
 *
 * - **integrity** — every content hash recomputes, and the Merkle chain holds.
 * - **schema** — every body with a shape block declares a record type the tree
 *   carries, and validates against it.
 * - **references** — every edge, commit and Locator names something that exists,
 *   and every Locator's `contentHash` matches the body it addresses.
 * - **origin** — who vouches for this. `not-established` until the seal
 *   (chapter 6) ships; never silently `pass`.
 *
 * `ok` and `problems` are kept, and `ok` is exactly *no verdict failed* — a
 * `not-established` origin does not make a tree invalid (§6.2: the seal is
 * additive, never a gate).
 */
export interface KoineVerifyResult {
  readonly ok: boolean
  readonly problems: readonly string[]
  readonly integrity: KoineVerdict
  readonly schema: KoineVerdict
  readonly references: KoineVerdict
  readonly origin: KoineVerdict
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
