# Koine Format — SPEC v0 (DRAFT)

> **Koine (the Koine Format) is an open standard for knowledge that outlives its author** —
> what a team means by its own terms: definitions, types, decisions and their history as
> ordinary files, sealed and packaged in the same form. This document specifies that form.

**Status: v0 draft — designed in the open. Re-cut 2026-08-24** (the consolidation revision —
see [Changelog](#changelog), which carries the old→new section map). The form version stays
`v0`: the `$id` frame `koine/types/<name>@v0` and the proposal envelope `koine/proposal@v0`
are unchanged by this revision — what changed is this document. Sections marked **TBD** are
declared gaps ([Declared gaps](#declared-gaps)), ordered by what real consumers actually
needed.

The key words MUST, MUST NOT, SHOULD, SHOULD NOT and MAY are to be interpreted as in
[RFC 2119](https://www.rfc-editor.org/rfc/rfc2119), but only loosely while this is a draft.

**One spec, nine chapters and one annex.** Each chapter names its provenance: **authored**
(this standard's own contribution), **composed** (assembled from existing standards, by
citation), or **adopted** (an existing rule taken as-is). A chapter whose mechanics the field
has already solved composes them rather than inventing siblings.

| Ch | Subject | Provenance |
|---|---|---|
| 1 | The form — floors · emission rules · carrier freedom | core |
| 2 | The dictionaries and the shape block | core · authored |
| 3 | The tree profile — identity map · edges · memory | profile · composed integrity, authored history |
| 4 | Validity — the gradient and the travel law | authored |
| 5 | Proposals — the day-one gesture | authored |
| 6 | The seal — proof of origin | composed envelope, authored delegation |
| 7 | The package — a frozen slice with shipping papers | composition profile |
| 8 | Extension profiles | adopted rule |
| 9 | *[Reserved]* The verbs | fills at its trigger |
| A | Mappings annex — adapters, one page each | grows without re-cutting the chapters |

## 1. The form

### 1.1 What a koine tree is — the three floors

A **koine tree** is a directory tree of ordinary files plus a `.koine/` sidecar directory.
Three floors; each stands alone — a consumer may stop at any floor and lose nothing below it.

| Floor | What travels | Where |
|---|---|---|
| **0 · the tree** | any LLM-readable files, named and arranged | the tree itself |
| **1 · the grammar** | the identity map, the typed graph slice, the dictionaries | `.koine/` |
| **2 · the memory** | attributed semantic commits under a tamper-evident chain | `.koine/history/` |

Floor 0 needs no manifest, no frontmatter, no required layout. **A bare floor-0 tree is
already a koine tree.**

Koine specifies the **shape** of meaning (level 2): what a definition consists of, how
identity, relations and history travel. It never specifies anyone's **domain vocabulary**
(level 3) — what "active member" means at your organisation is yours.

**What knowledge lacks is not a diffable substrate — it is a declarable one.** Prose, tables
and graphs resist line-wise diffing, and that observation has been used to argue no shared
substrate is possible at all. It answers the wrong question. Anything can already *read* a
body of knowledge; what nothing can read is **what its author meant by its own terms** —
which types exist, what each one consists of, which instance is of which type. Koine supplies
exactly that: the dictionaries (§2.1) declare the types, the shape block (§2.2) binds an
instance to its type. Declaration, not diffing, is the missing layer.

### 1.2 A form, not a place

Koine does not occupy a cell in anyone's architecture; it fills one. The same bytes are the
same koine whether they lie in a git repository, a bare folder, an object bucket, a zip
archive (that archive is a package, chapter 7), a served resource, or a hosted collaborative
room. **No transport is prescribed** — because the sidecars carry identity, integrity and
history *themselves* rather than borrowing them from a carrier, the carrier is exchangeable.
The form is the constant; the workspace is the variable.

### 1.3 Normative scope — the core and the tree profile

Koine's own normative subject is the **meaning layer**: the dictionaries and the binding that
makes an instance legible against them. Everything a *handover* additionally needs — stable
identity per body, the asserted graph, the attributed history — is specified here too, as the
**koine tree profile**: the profile the package chapter requires of its payload (chapter 7).

| | What it is | Where |
|---|---|---|
| **The core** | what a bare describer implements to be legible: the four dictionaries and the shape-block binding | §2.1 · §2.2 · chapter 8, under §1.4's emission rules |
| **The koine tree profile** | what a handover additionally needs: stable identity per body, the asserted graph, the attributed memory | §3.2 · §3.3 |

Both are specified normatively; the split says **what a given implementation owes**, not what
is optional to write down. A tool that only describes (converting one workspace's types into
another's, or serving a vocabulary for an agent to read) implements the core and MAY stop
there. A tool that hands a body of knowledge to a stranger implements both.

### 1.4 Emission — the two rules everything else rests on

**1. Bodies travel verbatim — sidecar, never frontmatter.** A koine tree MUST NOT modify the
files it describes. Every existing tool keeps working; adding `.koine/` needs nobody's
permission. The mechanical reason frontmatter is *excluded* rather than merely discouraged: a
`contentHash` over a body that carries its own metadata would hash that metadata too, so
changing metadata would change the content hash. Circular.

**2. Emission is canonical.** Two emitters given the same data MUST produce the same bytes,
so that `emit → parse → emit` is byte-identical:

- **Fixed key order.** Every sidecar shape below fixes the order of its keys; an emitter MUST
  NOT reorder them. For the dictionaries the order is stated in §2.1.
- **JSONL is compact.** `nodes.jsonl`, `edges.jsonl`, `history/commits.jsonl` and
  `history/chain.jsonl` carry one JSON object per line with no insignificant whitespace, and
  **every line is `\n`-terminated, including the last**.
- **Dictionary documents are indented JSON** (two spaces) with a terminating newline — they
  are read by people as often as by machines.
- **An absent optional facet is omitted entirely, never emitted as `null`.** This is what
  lets the form grow without rewriting history: a tree written before a facet existed
  re-emits byte-for-byte unchanged, and a new facet is added at the position its role
  dictates, never by widening an existing key.

Without canonical emission a second implementation cannot exist: two emitters would produce
different bytes for the same data, the hashes would diverge, and the chain (§3.3) would be
worthless.

### 1.5 The five laws

1. **Sidecar, never frontmatter** — bodies stay verbatim; the files are yours, unmodified.
2. **No merge, no branches, ever** — an incoming version is a proposal; the field-wise
   conflict list IS the merge.
3. **Executable members inert** — source and manifest travel; execution is platform-bound.
4. **Exclusions absolute** — membership, permissions, presence, secrets, pending proposals
   and live threads never travel.
5. **Every floor stands alone** — enters simple, grows up.

## 2. The dictionaries and the shape block (core)

### 2.1 `types/` — the four dictionaries

One file per declared type. **The FILENAME is the binding** — §2.2 resolves a body's `kind:` to
`types/<kind>.schema.json`, never to an `$id` — and koine stamps `$id` with `koine/types/<name>@v0`
only where the document carries none. **A schema that arrives with its own `$id` keeps it**, and a
reader strips only the stamp koine itself wrote. A codec that accepts an identifier and later
substitutes a different one silently is worse than one that refuses it at the door; treating the
stamp as koine's to own is how a `urn:` id came back as `koine/types/…` on the next emit.

- **`<name>.schema.json`** — a **record type**: a JSON Schema document, carried verbatim
  beside its `$id`. A record type's dictionary entry is exactly
  `{name → types/<name>.schema.json}`; everything the type declares lives inside the schema
  document, including any vendor extension keys (chapter 8).
- **`<name>.tagtype.json`** — a **kind**: `name` · `description` · `cascade` · `proactivity`
  · `contentFormat`, and OPTIONALLY `provenance` — custody, i.e. who defined this kind and
  under what seal. `provenance` is a JSON object carried verbatim; this document declares no
  custody vocabulary ([Declared gaps](#declared-gaps)), and a reader MUST ignore keys it does
  not know rather than reject the file.
- **`<name>.edgetype.json`** — a **link type**: `name` · `description` · OPTIONALLY `cascade`
  · `directed` · `transitive` · `weight`. Absent `cascade` means *not declared* — never a
  default.

**Key order (normative).** `$id` · identity (`name`, `description`) · the shared facet
(`cascade`) · the dictionary's own facets in the order listed above · custody (`provenance`)
last. `cascade` sits at the same index in every dictionary that declares it, because all
three meaning types share one base — a reader comparing two dictionary files finds the common
facets in the common place.

The fourth dictionary — **format** — has no sidecar file kind of its own in this version; a
body's format travels as the `format` field of its identity-map row (§3.2). This is a
declared gap ([Declared gaps](#declared-gaps)), not a statement that formats are
undeclarable.

### 2.2 The shape block

A definition declares its shape in a fenced code block with the info string `shape`, inside
its own body. Grammar:

- **At most one** shape block per file; the first is normative, any later one is content.
- One declaration per line: `key: value`. `key` matches `[a-z][a-z0-9-]*` and is unique
  within the block. The separator is the **first** occurrence of `": "` (colon, space);
  the value is everything after it with trailing whitespace stripped. Values may contain
  `": "` themselves; there is no escaping and there are no comments. Blank lines are
  ignored.
- **`kind` is required** and names the record type; the declared schema lives at
  `.koine/types/<kind>.schema.json`. The parsed block MUST validate against it — this is
  the parse that receipt steps 3 and 4 (chapter 5) perform.
- **`state` is reserved** and, when present, declares the body's position on the validity
  gradient (chapter 4). It MUST be one of `spoken` · `draft` · `valid` · `frozen`.

**The block is a text serialization of a typed record, and the whole block is the
instance.** Two consequences a validator MUST implement, because leaving either implicit
made the rule above unsatisfiable rather than strict:

- **Values are coerced to the type the record type declares** before validation — a
  declaration reads `window: 90`, and a schema saying `{"type":"integer"}` sees the number
  `90`. Without coercion no record type with a non-string field could be declared in a shape
  block at all. A value that cannot be coerced is validated as the string it is, so the
  verdict names the field instead of failing as a parse error with nothing attached to it.
- **`kind` and `state` are part of the validated instance, not hidden from it.** A record
  type MAY constrain them (the worked `metric-definition` pins `kind` with `const` and
  `state` with an `enum`, and requires both), and a record type that closes itself with
  `additionalProperties: false` MUST admit them. A codec that quietly removed two keys before
  validating would make a closed schema's verdict a lie about what the body carries.

**The JSON Schema keywords a conformant validator asserts on** — declared, so that two
implementations agree on what *validates* means: `type` · `const` · `enum` · `required` ·
`properties` · `additionalProperties` (boolean) · `items` · `minItems` · `maxItems` ·
`minimum` · `maximum` · `exclusiveMinimum` · `exclusiveMaximum` · `minLength` · `maxLength` ·
`pattern` · `anyOf` · `oneOf` · `allOf` · `not` · `if`/`then`/`else`. An unrecognized keyword
is IGNORED, per JSON Schema's own rule and chapter 8's. `$ref` and every form of schema
reuse, `dependentSchemas`, `dependentRequired`, `patternProperties`, `propertyNames`,
`unevaluated*`, and `format` as an assertion are **outside** this profile; a record type that
needs them is outside the shape block's reach, and saying so is cheaper than a reference
implementation that carries a general validator.

**A boolean IS a schema** (JSON Schema core): `true` admits every value, `false` admits none, and
a validator MUST honour both wherever a subschema may appear — inside `not`, `properties`,
`items`, `anyOf` and the rest. Treating a non-object schema as *nothing to check* inverts three
keywords at once and fails OPEN in two of them.

**Value equality ignores object key order, and ABSENCE is not `null`.** A missing member and a
member whose value is `null` are different facts — chapter 5's diff turns on exactly that
distinction — so equality answers presence before it compares values. `const` and `enum` compare
shapes, and a shape's key order is not a fact about it: a record written by one producer and re-serialized by a reader is
the same record. An equality that depended on serialization made `const` reject the very object it
names.

**One filename, one definition.** `types/<name>.schema.json` may be claimed either by a
free-standing record type (§2.1) or by a kind that declares a payload shape — a kind that
does so emits **two** files: its behaviour facets in `<name>.tagtype.json` and its payload
shape beside them under the record-type filename, docked back onto the kind on parse. The
same name claimed from both sides is an error at emit: one name cannot resolve to two
definitions.

## 3. The tree profile

### 3.1 The seam inside floor 1

**Floor 1 is not atomic.** The identity map serves **handover integrity** — an envelope
(chapter 7) reads it, and a packaging implementer needs nothing else from this floor. The
dictionaries and the edges beside it are the **describer layer**, which that same implementer
never touches. So a packaging reader stops *inside* floor 1 rather than below it.

Say **"the identity map"** and **"the dictionaries and edges"** for the two halves. Do
**not** introduce a fourth floor number for the seam: the floors are numbered by what a
consumer may stop after, and the seam runs across readership, not across consumption depth.
Three cuts, three jobs — the **floors** (§1.1) cut by consumption depth; the **seam** (this
section) cuts by readership; the **normative scope** (§1.3) cuts by what an implementation
owes. This document's chapters follow the scope cut: the dictionaries are chapter 2 (core),
while the identity map *and* the edges are this chapter (profile) — edge instances are data,
and only the edge *type* (§2.1) is vocabulary.

### 3.2 `nodes.jsonl` and `edges.jsonl` — identity and the asserted graph

- **`nodes.jsonl`** — the identity map. One JSON object per line:
  `{"id", "path", "format", "contentHash", "state"?, "absent"?}`. `id` is stable across renames;
  `contentHash` is `"sha256:" + lowercase-hex sha256 of the file's exact bytes`. No id scheme
  is prescribed — only that an id outlives a path.

  **`state` is how validity travels** (chapter 4). A body DECLARES its state in its shape
  block; the identity map is where that declaration crosses the boundary, because a receiver
  cannot be asked to parse every format in the world to learn whether a body may be
  republished. Where a body declares a state the two MUST agree, and a tree in which they
  disagree fails verification (§3.5): one body cannot be in two states. Where a body declares
  none — most bodies are not definitions — the identity map is the state's only carrier and
  that is correct, not a shortfall. **The key is omitted when the body is on no gradient at
  all**, and absent is NOT the same fact as `"state":"spoken"`; chapter 4's travel law turns
  on exactly that difference.

  **`absent` says this body is REFERENCED and NOT CARRIED** — `{"reason"?, "required"?}`, the
  key's presence being the declaration. Without it a package can reference a body it does not
  carry only by leaving it out, which is indistinguishable from not referencing it — so a
  reader cannot tell an incomplete package from a complete one, and a required-but-absent body
  cannot block anything. **`contentHash` stays the digest of the body that is not here**, and
  that is what makes the declaration useful rather than a note: a receiver that obtains the
  body elsewhere can check that it is the right one. `reason` is a short recording
  (`oversize`, `restricted`, `by-reference`) and this document declares no vocabulary for it,
  for the same reason it declares none for `format`. `required: true` means a consumer MUST
  NOT activate the package without the body; absent reads as false, because **a package may be
  honestly incomplete and still useful, and being able to say which it is IS the declaration.**

  A tree using `absent` MUST require the `absent-body` capability (§8.1), and this is stronger
  than a verification rule: a reader that ignores the key concludes it holds everything, so an
  emitter MUST refuse to write such a tree and a parser MUST refuse to read it. Note what this
  is NOT: raising a package's size caps. Those limits are the right size for knowledge and the
  wrong size for evidence, and moving them solves nothing about access, transfer or restore.

  **Verification asks an absent row the opposite question** (§3.5): the tree MUST NOT carry a
  body it declares absent. A row claiming absence over a present file is a package lying about
  itself in the safest-looking way.

- **`edges.jsonl`** — the typed graph slice: `{"from", "to", "type"}` over node ids; `type`
  names an edge type declared in `types/`. An edge a reader can recompute from the bodies (a
  wiki-style link, for instance) is an index rather than truth, and an emitter MAY omit it;
  an **asserted** edge, which no body implies, has nowhere else to live and belongs here.

  Seven optional facets may follow, each omitted when absent (§1.4), so that a three-key line
  written before they existed re-emits byte-for-byte and a reader that understands none of
  them still reads a correct edge:

  | facet | what it carries |
  |---|---|
  | `fromLocator` · `toLocator` | where that end LANDS inside its body, and against which version — §3.4 |
  | `actor` | who asserted it, as `actor:(user\|agent):<id>` — the spelling §3.3 uses |
  | `when` | when it was asserted; ISO-8601 **UTC (`Z`)** |
  | `validFrom` · `validTo` | the interval the assertion is held to be true; `validTo` absent means still held |
  | `weight` | a number — the **instance carrier** for the `weight` *semantics* its edge type declares (§2.1) |

  **`actor`, `when` and the interval are what make an assertion one**, and an emitter that
  knows them SHOULD carry them; they are optional only because requiring them would make
  every emitter fabricate what it was never told. **`weight` closes a half-law**: the edge
  type dictionary has declared weight semantics since this document's first version and no
  travelling edge could carry a weight — a meaning that could never be exercised. The
  dictionary says what a weight MEANS; the instance says what it IS. Removing the declared
  meaning to match the missing field was the other available repair, and it is never the
  right one.

  A **free-form payload on an edge is deliberately absent.** A relation that needs its own
  fields is reified as a body and pointed at, which this form already expresses and which
  needs no new law.

**The digest spelling is `sha256:<hex>` — everywhere in this standard.** Per-file
checksums over a file tree are eight-year-old, RFC-numbered prior art, and this profile
deliberately sits in that lineage rather than beside it: BagIt (RFC 8493) made SHA-256
manifest rows mandatory vocabulary, and WACZ 1.1.1 carries the same `sha256:<hex>` spelling
in production. The spelling is adopted by citation; SRI base64 (`sha256-<base64>`) is a
browser-subresource dialect and appears in this standard only where the v0 package dialect is
read (§7.11).

### 3.3 The memory — `.koine/history/`

- **`commits.jsonl`** — attributed semantic commits, one per line:
  `{"seq", "actor", "what", "why", "when", "node"?}`. `actor` is `actor:(user|agent):<id>`;
  `when` is ISO-8601 **UTC (`Z`)** — no other timezone form is valid.

  **`what` is prose, and a conformant reader never parses it as an identifier.** A producer
  saying WHICH body a commit touched says it in **`node`**, by id, against the identity map —
  the declared binding between the memory and the tree it remembers. Absent means the commit
  is about the tree rather than about one body (a release, a rename sweep, a dictionary
  change). The field is single: a commit touching several bodies is several commits, and that
  is what gives the frozen-slice filter (§7.6) one unambiguous question to ask of each line.
  Before this binding existed the only place to express it was `what`, where no foreign
  reader can tell an id from a sentence — and where a frozen slice then carried it past the
  gate.

  **`actor:(user|agent):<id>` is ONE grammar, and every field naming an actor is validated
  against it.** This document has three such fields — `actor` here, a proposal's `proposer`
  (chapter 5) and a seal's `author` together with its certificate's `delegatedTo` (chapter 6)
  — and they are the same grammar, not three similar ones. `<id>` is non-empty, the role is
  exactly `user` or `agent`, and nothing else parses. A reader MUST refuse a malformed actor
  wherever it appears, and the refusal names the field it refused.

  Stated normatively because it was implemented three times at three strictnesses, and a
  grammar with three readers is not a grammar. Measured against the reference codec on
  2026-09-17: `actor:user:` — a role with no identity behind it — was a valid proposer and an
  invalid seal author, and `bob` was a valid commit actor and invalid everywhere else. Neither
  split was a decision anybody made; both were the gap between one rule and its copies.
- **`chain.jsonl`** — the Merkle chain. Line 1 is a header declaring `format` and `algo`.
  Then one link per commit: `{"seq", "commit", "prev", "hash"}`.

**The chain algorithm (normative):**

1. `commit` = sha256 of the **exact bytes of the corresponding `commits.jsonl` line**, UTF-8,
   **without** its terminating `\n`. Every line in both files IS `\n`-terminated, including
   the last.
2. `hash` = sha256 of the ASCII concatenation `prev + commit` (both lowercase hex).
3. Genesis `prev` = 64 zeros.

A verifier is a few lines in any language. The chain proves **order and integrity** — a
rewritten field breaks its own link and every later one, and any second holder's copy exposes
a rewritten tail. It does **not** prove authorship (that is chapter 6).

**What is composed here, and what is authored.** The integrity mechanics — per-file digests,
one chain of hashes — are the field's (BagIt · OCFL · WACZ), taken by citation. What no
packaging standard carries, and what this floor authors, is the **attributed semantic
history**: commits that record *who* changed *what* and *why*, under links that make the
record tamper-evident. OCFL versions bytes; this floor versions meaning, with names on it.

### 3.4 The Locator — addressing a PART, and saying which version

An edge endpoint names a body. A **Locator** says where inside that body the end lands, and
**against which version it landed** — so that knowledge which is ABOUT something can travel
at all: an annotation, a citation, a measurement, a finding with its evidence. Without it
every such claim crosses at whole-body grain, and a link-rot check over a forty-page document
can report only *this document has a dead link*.

```jsonc
{"from":"n-claim","to":"n-source","type":"supports",
 "toLocator":{"contentHash":"sha256:<hex>","selector":{"type":"page","number":14}}}
```

- **`contentHash` is REQUIRED**, and it is the whole reason this shape earns its place. Every
  anchor vocabulary in the field resolves a pointer against whatever the body says today;
  when the body is replaced the pointer still resolves and now names something else —
  silently. With the hash inside the Locator a receiver can answer *"this was taken against a
  version you no longer hold"*, which is the honest answer and the one nobody can give
  without it. A Locator without it is not one.
- **`selector` is OPTIONAL.** A Locator with none addresses the whole of *that version* — a
  version-pinned whole-body reference, which is a real thing to want.

**This is not a new kind of thing, and not a fifth dictionary.** An edge type says what a
relation MEANS and what it admits at each end; a Locator says where an end LANDS. A form with
every edge type in the world and no Locator still cannot say *page 14*.

**The selector vocabulary is CLOSED — six types.** Each is taken from the field rather than
invented, and each was chosen by measuring the formats knowledge actually travels in.

| `type` | fields | prior art | the formats it serves | how it degrades when the body moves |
|---|---|---|---|---|
| `text-quote` | `exact`, `prefix`?, `suffix`? | W3C Web Annotation `TextQuoteSelector` | every text format | **the only one that survives an edit** — it re-anchors by search. Ambiguous without context, and a reader MUST report ambiguity rather than pick |
| `text-position` | `start`, `end` — half-open, in **Unicode code points** | W3C Web Annotation `TextPositionSelector` | every text format | exact and brittle: any edit before the region shifts it. The Locator's `contentHash` is what convicts that |
| `line-range` | `start`, `end`? — **1-based, inclusive** | the concept is RFC 5147's `#line=` | source, plaintext, jsonl, transcripts | shifts like a position, at line grain; a reformat that preserves lines survives it |
| `page` | `number` — 1-based | the page itself | pdf | stable within a version, meaningless across a re-export |
| `time-range` | `start`, `end`? — seconds | W3C Media Fragments `#t=` | audio, video | stable unless the media is re-encoded against a different origin |
| `json-pointer` | `pointer` — RFC 6901 | RFC 6901 | json, yaml, toml, tabular bodies, a shape block | **survives reformatting**; breaks on a renamed key or a reordered array |

The indexing above is declared here rather than inherited: RFC 5147 is cited for the *idea*
of a line fragment, and koine counts from one because every face that shows a person a line
number does.

**Why closed, when chapter 8's extension rule is open.** A reader that ignored an address it
did not understand would read *"supports page 14"* as *"supports the document"* — a widening
wearing compatibility's clothes. Widening this vocabulary is a revision of this document,
never a vendor profile. A parser MUST reject an unknown selector type.

**Resolution has four answers, and the middle two are the point:** *resolved* (the version
matches and the region was computed) · *stale* (the hash has moved — never silently
downgraded into a best-effort region) · *opaque* (the version matches and the address is
well-formed, but naming the region needs a format-aware reader — a page, a media offset) ·
*not-found* (the version matches and the selector reaches nothing).

An emitter MUST refuse a Locator whose `contentHash` does not match the body its endpoint
names: a pointer that is broken at the moment it is written should not be discovered by
whoever tries to follow it.

**A resolver DERIVES the version it resolves against.** It is handed the Locator and the body
and computes that body's digest itself. An entry point that also ACCEPTS the actual hash can
be handed the Locator's own — and then every pointer resolves, always, and nothing in the
result says so. `stale` is the entire yield of the required `contentHash`, and a
caller-supplied digest is the one input that can put it out of reach; this is §7.15's shape (a
verifier told what it is checking) standing in chapter 3.

A caller resolving many Locators against one body may hash that body once and reuse the digest.
That variant is legitimate and MUST be a **separately named** entry point rather than the
default one, so that reuse is something a reader of the call site can see.

### 3.5 Verification — four questions, four answers

A verifier reports **four verdicts**, separately. Each is `pass`, `fail`, or
**`not-established`** — *nothing here was checked*, which is a third fact and not a polite
spelling of either other one.

| verdict | the question |
|---|---|
| **integrity** | every `contentHash` recomputes, and the chain (§3.3) holds |
| **schema** | every body that declares a shape block names a record type this tree carries, validates against it (§2.2), and its declared `state` agrees with the identity map's |
| **references** | every edge, every commit `node` and every Locator names something that exists — and every Locator's `contentHash` matches the body it addresses |
| **origin** | who vouches for this (chapter 6). `not-established` until a seal travels |

One boolean over four unrelated questions cannot be acted on: a tree whose bytes are intact
and whose bodies contradict their own record types is not the same artifact as one whose
chain is broken, and a reader handed `false` for both has to re-derive which it holds. The
same applies in the other direction and is why `not-established` exists — **an unasked
question that reports `true` is indistinguishable, at every call site, from one that was
asked and passed.**

A `not-established` **origin does not make a tree invalid**: the seal is additive, never a
gate (§6.2). A verifier's overall pass is *no verdict failed*.

## 4. Validity — the gradient and the travel law

The states are `spoken → draft → valid → frozen`, declared in the shape block's `state`
field (§2.2). A floor-0 file without a shape block reads as `spoken` — an utterance, not yet
a commitment.

**Declaring travels; reading does not.** A body's declaration crosses the boundary in its
identity-map row (§3.2), because a receiver cannot parse every format in the world to learn
whether a body may be republished. **A state enforced only where the emitter stood is not a
law — it is a call parameter**, and this specification carried exactly that defect through
its first year: the gradient was stated here, applied at emit, and written into no field, so
a tree could be parsed and re-emitted and arrive with its gradient gone.

**One resolution, and every emitter calls it.** A body's state can be stated in two places:
the shape block inside the body, and the value an emitter is handed — a producer's parameter,
or the identity-map row of a tree being re-emitted. **The body's declaration wins**; the handed
value answers only where the body declares nothing; and a body declaring a state different from
the one asserted for it is a REFUSAL at every boundary, never a silent pick between two
readings.

The rule is one rule. Two boundaries carry it — §1.4's tree emission and §7.4's sealing — and
the second was written second, as the repair for *the seal drops the state*: a copy of the law
placed beside the original. That is how a law acquires a hole, because copies stay equal only
until somebody edits one. An implementation resolves the state in ONE function and both
boundaries call it; what differs between them is the error each raises, not the reading.

Five rules:

1. **Promotion is the core gesture, and it is never silent.** Every state change is a
   semantic commit (§3.3): attributed, appended to history. A state that changed without a
   commit saying who and why is a defect the chain makes visible.
2. **The declared `owner` promotes and demotes.** Anyone may propose (chapter 5).
   Application of an accepted proposal by the owner preserves the node's state; applied by
   anyone else, the node lands at `draft` pending the owner's re-promotion. (This answers
   the worked example's open question mechanically.)
3. **Frozen is immutable.** Amending frozen content is not expressible — a change creates
   a successor node, edge-linked to its predecessor.
4. **The travel law: only `valid` and `frozen` enter a frozen slice** (a package,
   chapter 7). A body that declares a state below `valid` MUST NOT enter — draft thinking
   travels with the room; the package boundary is where the gradient gates. A body that
   declares no state (`spoken`) is outside the gradient's gate: it travels as what it is —
   an utterance — and packaging does not promote it. The living clone carries every state;
   the gate refuses declared-but-unpromoted thinking, it does not require declaration.

   **Absent and `spoken` are different facts, and the gate turns on the difference.** Stated
   as the two tests an implementation runs, because one reading of the paragraph above cost
   this standard a conformance defect: a row whose `state` **key is absent** travels; a row
   declaring `"state":"spoken"` or `"state":"draft"` does not. Writing `state ?? "spoken"`
   collapses the two, and a frozen slice of an undeclared tree then yields **zero bodies** —
   a codec contradicting §7.6 of the document it implements, with a green test suite over it.

5. **A frozen slice is a complete artifact over what survived, not a tree with its node list
   shortened.** Whatever the gate withheld, the slice does not carry and does not NAME:

   - history bound to an excluded body (`node`, §3.3) does not travel, and the surviving
     commits are **renumbered from `seq: 1`** with a chain recomputed over them — so no gap
     reports how much was withheld, and the chain that ships is verifiable rather than a
     chain with holes in it;
   - an emitter MUST refuse a slice in which any surviving sidecar — a commit's prose, a
     dictionary document — still spells an excluded body's id. Filtering the node list while
     the memory keeps talking about what it withheld is redaction that redacts nothing.

## 5. Proposals — the day-one gesture

Law 2 makes the proposal the day-one gesture: there is no merge — an incoming version IS a
proposal, and the field-wise conflict list IS the merge. The envelope was extracted from what
the first foreign consumer actually produced, then declared. Normative schema:
[`schemas/proposal.schema.json`](schemas/proposal.schema.json) (`koine/proposal@v0`); worked
example: [`examples/proposals/active-member-60d.proposal.json`](examples/proposals/active-member-60d.proposal.json).

A proposal is a **standalone whole item** (typically sub-kilobyte). Per Law 4 it never
travels *inside* the target tree — it rides any carrier: a PR, an email, a relay, a message.
Its parts:

- **`target`** — node id, path, `baseContentHash`, and optionally a **`selector`** (§3.4):
  the content the proposal was drafted against, and where inside it the change lands.
  Staleness is mechanically detectable, never discovered mid-apply.
- **`baseChainHead`** — the history head at drafting time: the receiver can tell whether
  history moved since.
- **`changes`** — the field-wise diff (`field` · `from` · `to`), the proposal's whole intent.
  **`from` and `to` are arbitrary JSON**, and either may be **OMITTED to mean the field is
  absent on that side** — an addition, or a removal. `null` is the JSON value null and is a
  different fact; JSON cannot write *not there* as a value, so the key's presence carries it.
  A change omitting both is not a change.
- **`resultingShape`** — the complete shape after the changes, checkable against the declared
  record type in `schema`. Absent for a body proposal (below): prose has no declared shape.
- **`openQuestions`** — what the proposer could NOT decide, surfaced instead of silently
  resolved (a judgment call the shape cannot make for them).
- **`proposer` · `when` · `rationale`** — attribution (attributed, not proven — proving is
  chapter 6).

**Two grains, one envelope.** A **shape proposal** changes a definition's declarations — the
original gesture, field-wise, checked against the record type. A **body proposal** changes an
addressed REGION of a body: `target.selector` says where, and `changes` is exactly one change
whose `field` is the reserved name **`body`**, with `from`/`to` the region's current and
proposed text. One reserved name keeps the diff field-wise, which is Law 2's shape, while
letting an end land on prose.

**That second grain is what §3.4 bought, and it was a real impasse.** This envelope's target
was field-grained and a live editor's proposal is a text range, so *the day-one gesture and
the day-one gesture could not express each other* — a foreign consumer could read a package
and never answer it in the grain it works in.

**Receipt semantics (normative).** A receiver, in order: (1) validate the envelope against
`koine/proposal@v0`; (2) check staleness — `target.baseContentHash` against the current
`nodes.jsonl` entry, `baseChainHead` against the current chain head; a stale proposal is
re-based or returned, never force-applied; (3) validate `resultingShape` against the declared
record type — for a body proposal, resolve `target.selector` against the current body instead,
where `stale` or `not-found` is a staleness verdict and never an apply; (4) recompute
`diff(currentShape, resultingShape)` — it MUST equal `changes`, else the proposal is
internally inconsistent and rejected; for a body proposal, the addressed region MUST equal the
change's `from`; (5) produce the conflict list: each change is classified **both-intentional**
(a human decides) or **one-is-wrong** (the shape itself convicts — e.g. a rate without a
denominator). The conflict list is the output of receipt, not its cost.

**How the two classifications are decided, mechanically.** A change whose `from` still equals
what the holder has is no conflict at all — the base is intact for that field. Where they
differ: if either candidate makes the resulting shape fail its record type, the shape has
convicted one of them and the verdict is **`one-is-wrong`** — no human is needed. If both
candidates are legal shapes, two people meant different things and only a person can choose:
**`both-intentional`**.

**Receipt never writes.** A receiver that applied as it read would make step 5 unobservable,
and the conflict list is the whole product.

**Acceptance semantics.** On acceptance the holder: edits the body, recomputes the node's
`contentHash`, and appends one commit + one chain link (§3.3) — **bound to the node it
touched, via the commit's `node` field**. History is append-only — prior values remain as
record, never edited. An accepted proposal is thereafter stale against the tree it was applied
to, which is how a second holder learns not to apply it twice.

**A normative MUST with no reference implementation is not normative; it is a wish.** This
chapter carried five ordered MUSTs, a schema and a worked example for a year with no receiver
on either side of the boundary, so nobody could check anyone's conformance to it — these
editors' own included. The receiver ships with this revision.

## 6. The seal — proof of origin

The chain (§3.3) proves **order and integrity** — a history nobody can rewrite unnoticed. It
never proves **authorship**: actor strings are claims until signature material backs them.
This chapter closes that gap. It is drafted from a live reference implementation (per-actor
BIP-340 keys, boundary signing, an offline verifier), not invented ahead of one.

### 6.1 Who this chapter is for

The audience is **everyone who must decide whether to trust text they did not write** — four
concrete classes:

- **Agent workspaces and skill consumers.** Extensions and knowledge enter org-wide the
  moment they are added — with no authorship, no mandate, no integrity. A verifier run before
  ingestion is the belief-injection defense: you can sandbox code, not a "fact" already in
  the context window — so origin is checked *before* it enters.
- **Tool makers without a provenance substrate** (wikis, CMS, editors, doc generators, agent
  frameworks). Building provenance infrastructure is a product in itself; a seal gives their
  exports checkable origin **for the cost of a sidecar file**.
- **Auditors, compliance and procurement.** N vendors, N proprietary assertions, all "trust
  us" — replaced by **one verification procedure** for any artifact from any tool, offline,
  in ~50 lines. The live regulatory referent is the EU AI Act's Art. 50 transparency
  obligations (applicable 2026-08-02): machine-readable provenance for machine-generated
  content stops being optional paperwork.
- **Agent platforms needing delegation accountability.** "An agent wrote this" answers
  nothing — *which* agent, authorized by *whom*, and does the mandate still stand? The
  delegation certificate (§6.7) carries that chain in-artifact, and revocation (§6.9) works
  without erasing history.

### 6.2 Additive, never a gate

An unsigned koine tree is valid. Sealing degrades gracefully: integrity (hashes, the chain)
is always present; authorship proof is added where it matters. Nothing in this standard makes
a seal mandatory, and value is pairwise — **one emitter and one verifier already extract full
value**; verifiers free-ride by design.

### 6.3 Binding points — three grains, one model

A seal binds to content through hashes the tree already carries:

1. **The chain head.** One signature over the current head hash vouches the entire history
   under it (the Merkle property) — the tree-level seal, emitted at boundary moments:
   publish, release, handover. Never per interior commit.
2. **Any single file**, via its `contentHash` in `nodes.jsonl` — the file-level seal for
   material that travels alone (this is how an excerpt carries a verifiable claim back to
   its whole).
3. **The frozen slice**, at package grain: the manifest carries the tree's root hash and one
   signature over the manifest — seal → root hash → identity map → history. One signature,
   verification at every grain: check the seal once, the root once, then the whole package
   *or any single file* against the identity map (chapter 7).

   **The subject binds the PAPERS, not only the root hash**, and the distinction is the whole
   of §7.5's tamper story. The root hash covers the tree and `koine.json` is not in the tree
   (§7.3) — so a subject of `{name, version, integrity}` alone leaves `license`, `source`,
   `terms`, `requires` and `status` unsigned, and an attacker may rewrite the rights or redirect
   `payTo` without breaking a seal a buyer checks. The package subject therefore carries
   **`papers`**: a `sha256:` digest over the manifest with `provenance.signature` removed, keys
   recursively sorted, compact. Sorted keys are required here and nowhere else in this chapter
   — a seal payload is authenticated as raw bytes (§6.4), but a manifest is re-serialized by
   whoever reads it, so a digest over an unsorted projection would break on a reformat and train
   readers to ignore it.

   **A verifier DERIVES the subject from the artifact it is checking.** It MUST NOT accept one
   from its caller and MUST NOT read one out of the seal. Both are the same error: a seal
   checked against a subject it was handed proves that *some* package was signed, never that
   *this* one was — a genuine signature over one package will admit another, which is exactly
   what a composed API did until this revision. A caller's expectation may be compared against
   the derived subject; it may never stand in for it.

### 6.4 The envelope — a DSSE-compatible profile

The seal travels as a detached JSON sidecar (`<file>.seal.json` beside a standalone file; the
`provenance.signature` field of a package manifest, §7.3), **self-identifying** via its
`format` field and spec URL. The signing profile is **DSSE-compatible** rather than invented:

- **The signature is computed per DSSE** ([DSSE 1.0.2](https://github.com/secure-systems-lab/dsse)):
  over the pre-authentication encoding `PAE(payloadType, payload)`, so the field's dominant
  attestation tooling can verify the bytes. DSSE places *no restriction on the signature
  algorithm* — the scheme below rides legally.
- **Method and key live inside the authenticated payload.** DSSE authenticates only
  `payloadType` and `payload`; its `keyid` is an unauthenticated hint and MUST NOT be used
  for security decisions, and DSSE carries no algorithm field. Therefore the seal payload
  itself names `method` and carries the author's public key — the two facts a verifier needs
  are inside the signed bytes, never beside them.
- **The scheme:** BIP-340 Schnorr over secp256k1; public keys npub-encoded — existing
  ecosystem tooling encodes, decodes and verifies them.

**The payload — enumerated.** `payloadType` is `application/vnd.koine.seal+json`, and the
payload is a JSON object with these fields, **all of them inside the signature**:

```jsonc
{ "koine": "0",
  "kind": "koine/seal@v0",
  "method": "bip340",              // inside: DSSE carries no algorithm field
  "pubkey": "<64 lowercase hex>",  // inside: DSSE's keyid is an unauthenticated hint
  "npub": "npub1…",                // the same key, NIP-19, for existing tooling
  "author": "actor:user:<id>",     // or actor:agent:<id>
  "signedAt": "2026-09-17T12:00:00Z",
  "subject": { … one of the three grains below … },
  "delegation": { … a nested DSSE envelope, iff the author is an agent (§6.7) … } }
```

**The subject, at the three grains of §6.3:**

| grain | shape |
|---|---|
| chain head | `{"grain":"chain-head","hash":"<64 hex>"}` |
| a single file | `{"grain":"file","nodeId":…,"path":…,"contentHash":"sha256:<hex>"}` |
| a package | `{"grain":"package","name":…,"version":…,"integrity":"sha256:<hex>"}` |

**The signed message is `sha256(PAE(payloadType, payload))`** — 32 bytes. BIP-340 accepts an
arbitrary-length message; this profile fixes the digest so every implementation hashes the
same way and the primitive is exactly the one a delegation certificate uses. `PAE` is DSSE
1.0.2's: `"DSSEv1" SP LEN(type) SP type SP LEN(body) SP body`, with `LEN` the ASCII-decimal
**byte** length and `SP` one 0x20. Length-prefixing is what makes it unambiguous — without
it the same bytes could be re-split at a different boundary.

**There is no canonicalization rule in this chapter, and that is deliberate.** DSSE
authenticates the payload as **raw bytes**: the envelope carries them verbatim (base64) and a
verifier authenticates exactly those bytes before parsing them. So two implementations agree
on what was signed by construction — no sorted-key discipline, no RFC 8785, no JSON
canonicalization to get subtly wrong. The delegation certificate is a DSSE envelope for the
same reason: bytes all the way down.

**Conformance vectors** ship with the reference implementation
(`test/vectors/seal-v0.json`): each case names the envelope bytes, the subject a verifier
must recompute from content, and the expected verdict. An implementation is conformant when
it reproduces every verdict. **Declared gap 2 closes with this revision** — and the reason it
stayed open is worth recording, because the plan for closing it could not have worked: the
gap said the enumeration would be *extracted from the reference implementation's test
vectors*, and the reference implementation had a live BIP-340 path that signed a **different
envelope** — `sha256(canonicalJson(subject))`, with `method` and `pubkey` sitting outside the
signed bytes. There was nothing to extract that matched this chapter, so the chapter was
waiting on an extraction that could never arrive.

### 6.5 Verification — offline, four steps, no registry

A verifier consults nothing but the shipped bytes and public keys: (1) recompute the subject
**from content** and compare it against the payload's; (2) decode the author's public key;
(3) verify the signature over the PAE bytes; (4) for an agent author, verify the
**delegation certificate** (§6.7). ~50 lines in any language.

**Step 1 recomputes; it never reads the subject off the seal.** A verifier that took the
subject from the envelope would be checking the seal against itself, and every one of the
three grains would then vouch for nothing.

**What a failure names.** A verdict that is merely `false` cannot be acted on, so a
conformant verifier reports which step refused: `wrong-payload-type` · `wrong-method` ·
`malformed` · `subject-mismatch` · `bad-signature` · `delegation-key-mismatch` ·
`delegation-actor-mismatch` · `bad-delegation`. The same reasoning as §3.5's four verdicts,
at a finer grain.

### 6.6 Identity without a registry — the four anchors

A central registry would recreate the certificate-authority model the ~50-line verifier
exists to avoid. Who a key IS is answered by **four anchors, each optional, each additive**:

1. **Continuity.** The key pins on first use — every later artifact from the same author
   verifies against the same key. This alone answers the most common real question: *is this
   the same author as last time?*
2. **The way-home.** A source URI names the living place that can show the key, the history
   and the author's current standing. The seal is the receipt; the way-home is the till.
3. **Domain binding.** A publisher states their key at a domain they control (website, DNS,
   repository profile). Identity becomes "the key the domain vouches for" — no registry
   required, and npub compatibility means existing tooling resolves it.
4. **The delegation certificate** (§6.7), carried in-artifact.

### 6.7 The delegation certificate — authored

For agent-authored work the seal carries the chain of mandate **in the artifact**: the
responsible human's key signs a claim binding the agent's public key to theirs, so
`actor:agent:<id>` becomes a verifiable chain instead of a string — the receiver verifies the
mandate offline, whoever the parties turn out to be.

The certificate is itself a DSSE envelope, `payloadType`
`application/vnd.koine.delegation+json`, carried in the seal payload's `delegation` field:

```jsonc
{ "koine": "0",
  "kind": "koine/delegation@v0",
  "method": "bip340",
  "agent": "actor:agent:<id>",
  "agentPubkey": "<64 lowercase hex>",
  "by": "actor:user:<id>",
  "byPubkey": "<64 lowercase hex>",
  "byNpub": "npub1…",
  "issuedAt": "2026-09-01T00:00:00Z" }
```

signed by the **human's** key over its own PAE, exactly as a seal is.

**Structure before semantics.** A verifier MUST establish that `author`, `agent` and `by` are
well-formed `actor:(user|agent):<id>` strings BEFORE reasoning about what they mean, and MUST
refuse — never throw, never ignore — when one is not. An implementation that pattern-matched a
prefix accepted every actor string that matched no prefix at all, and crashed on an absent one;
neither is a verdict. And the mandate's `by` MUST be a **person**: a certificate signed by
another agent is a chain with nobody at the end of it, and it verified.

**The certificate is REQUIRED for an agent author, not merely checked when present.** A verifier
MUST refuse a seal whose `author` begins `actor:agent:` and which carries no `delegation` — an
absent mandate is not a satisfied one. A verifier that validated the certificate *if there was
one* gave a correctly-signed agent seal with no mandate at all the same verdict as a mandated
one, which is the defect this chapter exists to prevent.

**Two further bindings, and both are required.** A verifier MUST check that `agentPubkey` is the
key that signed **this** seal, and that `agent` is the author **this** seal claims. Without the
first, a valid certificate minted for another agent can be pasted onto this envelope; without
the second, an agent's certificate vouches for a seal claiming a different author.

This is the one part of the chapter with no prior art to compose: DSSE and WACZ carry no
delegation concept, and C2PA's trust model is X.509-only — structurally closed to
self-sovereign agent keys. It is authored here.

### 6.8 The sealed receipt

A check-run readout is a *claim about an artifact* — one more signable subject. Sealing a
readout produces the **sealed receipt**: the bounded claim *"this content passed suite S at
time T"*, vouchable offline like every other seal. Two rules keep it honest:

- **The receipt is additive, never a gate** — exactly like the seal itself.
- **The receipt does not amend the honesty law (§6.10).** The seal on a receipt proves who
  ran the suite and that the readout was not altered — the *origin* of the claim; whether
  the suite was the right suite stays a judgment. A receipt SHOULD be emitted
  attestation-compatible (§6.4's DSSE profile), so the supply-chain world's existing
  verifiers read it.

### 6.9 Revocation, honestly

Verification is stateless: past seals verify forever — revoking a key erases *authorization*
(it signs nothing new), never *authorship*. "Is this key revoked today?" is a liveness
question and belongs to the way-home, not the seal. Offline verification proves
origin-at-sealing-time; the living place answers current standing.

### 6.10 The honesty law

A seal proves **origin, never correctness** — WHO is the seal's answer; WHETHER stays the
validity gradient's. A signed wrong definition is wrong with a name on it.

## 7. The package — a frozen slice with shipping papers

### 7.1 What a package is

A **package is a frozen koine slice** — the same tree, stopped, **plus shipping papers**: a
directory (or archive of one) containing the payload and a manifest. The **irreducible**
papers are six: **corpus identity · version · terms · source · one root hash · the signature
binding them.** Nothing beyond the six is load-bearing for the envelope; that is a statement
about which papers cannot be removed, not a list of every field a manifest carries.

**This chapter is a composition profile.** Its mechanics are deliberately the field's own,
by citation rather than reinvention: per-file digests over a file tree are BagIt
(RFC 8493); manifest → digest-of-manifest → signature, chained over a tree, is the shape
WACZ 1.1.1 runs in production; the terms atom is SPDX (§7.5); the seal is chapter 6's
DSSE-compatible profile. What this standard adds is what the payload *is* — the meaning
layer, the gradient, the attributed history — and the papers' composition into one form.

What a package is **not**: not a runtime, server or query engine (it produces files; the
consumer's tools do the rest) — not a content standard (the envelope never dictates how
knowledge is written; the meaning layer travelling inside it has its own chapters, which is
still not the envelope's doing) — not a gatekept registry (the format works with zero hosted
infrastructure) — and not a carrier of consumer relationships (§7.7).

### 7.2 Layout

A package is a directory. It MUST contain a `koine.json` manifest at its root. Everything
else is payload: the bodies, in any layout the publisher chooses, plus the `.koine/` sidecar.

```
team-decisions/
├─ koine.json          # the manifest — the shipping papers (required)
├─ conventions.md
├─ decisions.md
└─ .koine/
   ├─ nodes.jsonl      # the identity map (required in a package)
   ├─ types/           # the dictionaries — as far as the tree carries them
   ├─ edges.jsonl
   └─ history/
```

**The payload is a koine tree at whatever floors it carries** (floors stand alone, §1.1) —
with one requirement the envelope itself needs: a package MUST carry the identity map
(`.koine/nodes.jsonl`) covering every body it ships. The root hash says *that* the archive
changed; the identity map says *which file* (§7.4). A sealing tool computes the map from a
bare tree — ids are minted at seal where none exist (no scheme is prescribed, §3.2) — so
floor-0 material packages without hand-writing a sidecar. The dictionaries, edges and
history travel exactly as far as the tree carries them; a packaging implementer reads only
the identity map (§3.1).

### 7.3 The manifest — `koine.json`

```jsonc
{
  "koine": "0",                         // spec version this manifest targets (required)
  "name": "team-decisions",             // corpus identity (required)
  "version": "2026.08.0",               // see §7.9 — versioning is OPEN (required)
  "description": "How our team makes and records architectural decisions.",
  "license": "CC-BY-4.0",               // terms: an SPDX license expression (§7.5)
  "readingFloor": 1,                    // which floor faithful consumption requires (§7.6)

  "requires": ["absent-body"],          // what a consumer MUST implement, or refuse (§8.1)
  "status": "https://acme.example/pkg/team-decisions/status.json",  // where this package's standing is published

  "source": {                           // where this package authoritatively lives
    "type": "git",                      // "git" | "path" | "url"
    "url": "https://github.com/acme/team-decisions",
    "ref": "a1b2c3d4",                  // commit/tag pinned at publish time
    "subpath": "."
  },

  "provenance": {                       // who published THIS PACKAGE
    "published_by": "acme",
    "published_at": "2026-08-24T10:00:00Z",
    "method": "bip340",                 // "git-commit" | "sigstore" | "minisign" | "bip340" | "none"
    "signature": null                   // the seal binding the papers — chapter 6's profile
  },

  "integrity": "sha256:<hex>"           // ONE root hash over the canonical tree listing (§7.4)
}
```

**The six papers, mapped onto the fields** — so the two readings cannot drift apart:

| Irreducible paper | Field |
|---|---|
| corpus identity | `name` |
| version | `version` |
| terms | `license` (+ the `terms` block, §7.5) — one subject, two words: *terms* is the standard's, `license` is the field |
| source | `source` |
| one root hash | `integrity` |
| the signature binding them | `provenance.signature` |

The **`koine` spec-version field is retained and is not one of the six**: refusal semantics
are unimplementable without it — a consumer MUST refuse a manifest whose major version it
does not understand. `description`, `readingFloor`, `representations`, `status` and the remaining
`provenance` subfields are **legal accompanying fields** — not irreducible, not thereby
forbidden. **`requires` is accompanying but not optional to READ**: it is the list of things a
consumer may not ignore, so §8.1 requires a validator to parse it (see below).

**Field notes**

- `name` — MUST match `^[a-z0-9][a-z0-9._-]*$`. Uniqueness is only meaningful **within a
  registry** (§7.8); a bare git source needs no global name.
- `version` — REQUIRED, but its **semantics are OPEN** (§7.9). Treat it as an opaque,
  orderable label for now.
- `readingFloor` — OPTIONAL; `0`, `1` or `2`. **Which floor a package carries is
  self-evident from the tree** (the sidecars' presence); the one non-derivable fact is
  **which floor faithful consumption requires** — a package whose meaning leans on typed
  links needs a floor-1 reader; plain prose does not. `0` declares the bodies
  self-sufficient: handable to a bare agent. Absent means undeclared; a consumer SHOULD then
  read the bodies as self-sufficient, which is the pre-field reading of every package.
- `source` — records the package's authoritative origin so a vendored copy can be traced
  back and re-fetched. The `ref` SHOULD pin an immutable point (a commit SHA, not a branch).
  The source is also the seal's **way-home** (§6.6): the living place that answers for the
  key and the current standing.
- `provenance` — attributes **the package's publisher**. The standard spells `provenance` at
  three grains, and none implies another: *this* one is who published the package; the kind
  dictionary's `provenance` is **custody** — who defined a kind and under what seal (§2.1);
  a vendor profile keyword `provenance` inside a record type's JSON Schema is a
  **field-grain derived-from** rule (chapter 8). `method` names the signing scheme;
  `bip340` is chapter 6's profile, whose binding rules live there.
- `requires` — capability tokens a consumer MUST implement to use this package, or refuse it
  by name (§8.1). Absent means the package demands nothing beyond the core.
- `status` — an absolute `http(s)` URL where this package's own standing is published.
  **Offline verifiability of an old package does not prove it may still be used today**: a
  withdrawn or superseded package verifies forever and keeps answering, and a form that can
  only say *these bytes are intact* has no way to say *and they are still current*. What the
  form owes is one declaration — where the answer lives — plus the reader's rules below. The
  revocation *service* stays outside this standard, deliberately: a mechanism here would make
  every consumer depend on an endpoint the format cannot guarantee.

  **The document a status source serves** — three fields, and no more, because anything larger
  would be the mechanism rather than the declaration:

  ```jsonc
  { "koine": "0",
    "status": "current",                 // "current" | "superseded" | "withdrawn"
    "since": "2026-09-17T00:00:00Z",     // OPTIONAL, ISO-8601 UTC
    "supersededBy": "2026.10.0",         // OPTIONAL, for "superseded"
    "note": "…" }                        // OPTIONAL, prose for a human
  ```

  **The reader's rules (normative).** A consumer that declares the `status-source` capability:
  MUST render a package whose status source it **cannot reach** as *possibly-stale*, never as
  current — rendering an unreachable source as current asserts exactly what it failed to
  check; MUST treat `withdrawn` as **removing the package from its answer context**, not only
  from a shelf, because a withdrawn package that still answers questions is the failure this
  declaration exists to prevent; and MAY continue to serve a `superseded` package while
  naming its successor. Serving the document, polling it, and caching it are the publisher's
  and the consumer's business, not the format's.
- `integrity` — the root hash, §7.4. `koine.json` itself is never covered by it and MUST
  NOT appear in the identity map: the manifest is the envelope, not a body — the seal
  (`provenance.signature`) is what vouches for the manifest.

**What a validator MUST check.** A v0 validator MUST enforce `koine`, `name`, `version`,
`integrity` and **`requires`** — including path safety for every payload path it reads
(§7.10). `requires` joins the list because it is the one accompanying field whose whole
purpose is to be honoured: carrying an unparseable `requires` through would defeat the
mechanism at its first use. `status` is checked only for being an absolute `http(s)` URL — a
malformed one is rejected rather than silently un-consulted. The remaining fields are carried
through unvalidated in the reference implementation: a malformed `source`, `provenance`,
`license`, `terms`, `representations` or `description` is preserved rather than rejected. A producer therefore cannot rely on a consumer to catch a wrong shape in those
fields.

**Representations *(OPEN)*.** `representations` is a free-form hint array (e.g. `"prose"`,
`"graph"`, `"table"`) so tools can route. Whether this should be a controlled vocabulary,
per-file rather than per-package, or dropped in favour of the identity map's `format` field,
is **open**.

### 7.4 Integrity — one root hash

The envelope carries exactly **one** integrity value: a root hash over the canonical tree
listing.

**The canonical tree listing (normative):**

1. Take every file in the package **except `koine.json` itself** — bodies and `.koine/`
   sidecars alike.
2. For each file, one row: `<path> <hex>` — the POSIX relative path from the package root
   (no leading `./`), one space, the **bare** lowercase sha256 hex of the file's raw bytes.
3. Sort rows by path, byte-wise lexicographic over UTF-8.
4. Join with `\n`, **terminating `\n` included**; encode UTF-8.

The root hash is the sha256 of those listing bytes, carried in `integrity` as
`"sha256:<hex>"`.

**Why one hash suffices — and why per-file hashes in the envelope are redundant.** The two
survivors have disjoint jobs: the **root hash** says *that* the archive changed; the
**identity map inside the payload** says *which file*, and carries the stable `id` and
`format` a root hash cannot express. A verifier that knows only JSONL, sha256 and this
listing convicts every tamper class — a changed body, a removed file, a rewritten identity
map, and a tampered dictionary or history file it cannot even parse (the rows cover
`.koine/` too). This is proven by a runnable falsifier in the reference implementation
(`test/tree.test.ts`, *"the envelope reach"*), roughly 18 lines. Verification of any single
file at finer grain goes through the identity map (§3.2); the seal binds the papers on top
(§6.3, grain 3): **seal → root hash → identity map → history.**

**Sealing PRESERVES the identity map's meaning.** A tool that rebuilds `nodes.jsonl` from the
files on disk MUST carry every semantic field a prior map held — `state` above all — and MUST
carry rows that declare an **absent** body, which by construction have no file for a walk to
find. A seal that kept only `{id, path, format, contentHash}` silently defeated the travel law
over the package path while it held over the tree path: a frozen slice of five bodies admitted
three, and the same tree sealed and re-exported admitted all five, including the draft the gate
had refused. **A law with two enforcers is a law with a hole in it.**

Where a body carries a shape block, its declaration and the map's row MUST agree at seal time,
and a contradiction is an error (§4 rule 1) — sealing is precisely where a promotion that never
reached the body would otherwise be laundered.

**A declared absence is not drift.** A package check MUST NOT report a declared-absent body as
missing, and MUST report a package as *incomplete* rather than *ok* when a body it declares
`required` is not carried. Reporting `ok` there is the shape of error this standard names most
often: a verdict whose good news covers a question nobody asked.

### 7.5 Terms — the SPDX atom and the priced half

**The `license` field's value is an [SPDX license expression](https://spdx.org/licenses/)** —
the universal atom (npm, PEP 639, Cargo and the SBOM world all speak it), adopted by
citation. It SHOULD be set; it answers *which license* and nothing else.

**The priced half — the `terms` block (frozen 2026-08-27).** Knowledge that travels with
terms richer than a license — payment types, permitted and prohibited uses, priced access —
needs a vocabulary, and the field has one: **[RSL 1.0](https://rslstandard.org/rsl)**, whose
enumerated values this section adopts by citation, exactly as `license` adopts SPDX. What
RSL cannot do is address *files inside a package* — its `url` is bound to an RFC 9309
robots path — and it defines no JSON serialization at all. **This grammar is therefore
authored:** it owns the carrier (a JSON block in `koine.json`) and the addressing (POSIX
package-relative glob patterns), and takes its value vocabulary from RSL, so a publisher's
package terms and their site-side RSL declarations speak the same words. The adopted axes,
pinned to RSL 1.0 — the values below are normative here, so a dead upstream cannot orphan
them:

- **payment types:** `free` · `attribution` · `purchase` · `training` · `crawl` · `use`.
  (RSL's `subscription` and `contribution` are deliberately not adopted — recurring billing
  and patronage need duration state a frozen slice cannot carry; chapter 8 is their road
  back.)
- **permits/prohibits axes:** `usage` (`all` · `ai-all` · `ai-train` · `ai-input` ·
  `ai-index` · `search`) · `user` (`commercial` · `non-commercial` · `education` ·
  `government` · `personal`) · `geo` (ISO 3166-1 alpha-2 codes).

**The shape.** The block is OPTIONAL; its absence means the whole package is free under
`license`:

```json
"terms": {
  "rsl": "1.0",
  "attribution": { "name": "Acme Research", "url": "https://acme.example/koine" },
  "payee": { "payTo": "0x1234…", "network": "eip155:8453", "asset": "0xA0b8…" },
  "entries": [
    {
      "paths": ["**"],
      "permits":   [{ "type": "usage", "values": ["search", "ai-index"] }],
      "prohibits": [{ "type": "usage", "values": ["ai-train"] }],
      "payment": { "type": "training", "amount": "5.00", "currency": "USD" }
    }
  ]
}
```

- `rsl` — REQUIRED. The pinned vocabulary version; `"1.0"` is the only value this version
  defines.
- `attribution` — OPTIONAL: how to credit (defaults to the provenance block's publisher).
  REQUIRED if any entry's payment type is `attribution`.
- `payee` — the settlement rail: `payTo` (the recipient's address — the author's, never a
  host's) · `network` (a CAIP-2 identifier) · `asset` (a token contract address, or an
  ISO 4217 code for off-chain rails). OPTIONAL; REQUIRED as soon as any entry prices above
  free. These three plus the price are exactly what an [x402](https://www.x402.org/) quote
  needs — the block declares the offer, the payment layer transacts it.
- `entries[]` — ordered. Each entry addresses payload members by POSIX package-relative
  glob `paths` (default `["**"]`; §7.10 path safety applies) and carries `permits` /
  `prohibits` arrays over the three axes plus one `payment` (`type`, with a decimal-string
  `amount` + ISO 4217 `currency` REQUIRED unless the type is `free` or `attribution`).
  Absent `entries` means one implicit free entry over `**`.

**The laws.**

- **Default free at every level.** No block, no `entries`, no `payment` — every absence
  resolves to `free`. Declaring the axes costs a publisher nothing until something is
  priced; that is the point of carrying them from day one.
- **Precedence is document order — last match wins** for overlapping globs. Most-specific-
  wins is undecidable for arbitrary globs; order is deterministic, and an author who wants
  the specific entry to win writes it later.
- **Per-release vs per-event rides the payment type**, no extra field: `purchase` buys this
  release — this `version`, this `integrity` root; `training` · `crawl` · `use` are
  per-event classes; `free` and `attribution` are unpriced.
- **Two money layers, one direction.** The terms layer speaks human money (a decimal string
  plus ISO 4217); the payment layer speaks atomic units of `payee.asset`. The conversion
  happens at quote time by whatever serves the payment challenge — never in the manifest,
  which stays human-legible and rail-agnostic.
- **The seal is the tamper story.** `terms` lives in the manifest and the seal (chapter 6)
  vouches for the manifest — so `payTo` sits inside the sealed papers, and redirecting
  payment to an attacker's address means breaking the seal a buyer checks before paying.
  The address travels with the goods, vouched, never fetched live from anyone.
- **The block declares an offer; nothing here transacts.** Settlement, token issuance,
  receipts and custody live outside the package. The place that serves a priced package
  holds no funds and runs no licensing transaction — license-server protocols are
  deliberately out of scope.
- **Carrying stays free.** A consumer that does not act on terms MUST carry the block
  through verbatim — unchanged from the block's reserved era. Only a consumer that acts on
  them (quotes, pays, filters usage) must parse them, and an unknown key inside the block
  is carried, never fatal. This is the deliberate opposite of ODRL's halt-on-unknown-
  profile rule, and the reason ODRL is a mapping in Annex A rather than the base.
- **A name, not a collision:** RSL's own `<terms>` XML element is a URL to supplemental
  legal text, unrelated to this block. A human-readable terms page travels as an
  `x-terms-url` extension key (chapter 8) until a field earns the slot.

A declaration binds no one who never assents. What this block does, jurisdiction-free, is
give machine-readable notice, state a machine-quotable offer, and — where such reservations
are recognized — stand as a machine-readable reservation of rights for the `ai-train`
class. It creates no copyright where none exists, and it discharges none of a seller's own
obligations.

### 7.6 What may enter

- **The travel law gates the boundary** (chapter 4, rule 4): a body that declares a state
  below `valid` MUST NOT enter a package; an undeclared body travels as the utterance it is.
  **An absent `state` and a declared `"spoken"` are different facts** — the first enters, the
  second does not; chapter 4 rule 4 states both tests.
- **A slice names nothing it withheld** (chapter 4, rule 5): history bound to an excluded
  body does not travel, the surviving commits are renumbered with their chain recomputed, and
  an emitter refuses a slice whose surviving sidecars still spell an excluded body's id.
- **Law 4's exclusions are absolute** (§1.5): membership, permissions, presence, secrets,
  pending proposals and live threads never travel — a package carries no field for them.
- **Law 3 holds at install** (§1.5): executable members travel inert — source and manifest,
  never activation. Nothing in a package is ever executed by adding it (§7.10).

### 7.7 The consumer side — vendoring, and what is not the package's

By convention, vendored packages land under `./knowledge/` in the consumer's tree, one
directory per package; the directory name MAY differ from the package `name` (an alias). The
lockfile is the source of truth for what is installed.

**The lockfile — `knowledge/.koine-lock.json`.** Written by the consumer's tool, committed
to the consumer's tree. For each installed package it records the requested source, the
resolved version and ref, the directory, and `integrity`: `"sha256:<hex>"` over **the exact
bytes of the vendored `koine.json`**.

```jsonc
{
  "koine": "0",
  "packages": {
    "team-decisions": {
      "requested": "github:acme/team-decisions",
      "version": "2026.08.0",
      "resolved": {
        "type": "git",
        "url": "https://github.com/acme/team-decisions",
        "ref": "a1b2c3d4",
        "subpath": "."                 // the package's location within the source
      },
      "dir": "knowledge/team-decisions",
      "integrity": "sha256:<hex>"      // digest over the vendored koine.json bytes
    },
    "domain-primer": {
      "requested": "path:../shared/domain-primer",
      "version": "2026.08.1",
      "resolved": { "type": "path", "url": "../shared/domain-primer" },
      "dir": "knowledge/domain-primer",
      "integrity": "sha256:<hex>"
    }
  }
}
```

A `path:` source records no `ref` and no `subpath` — there is no commit to pin and the path
already names the package root.

**Verify makes two comparisons and requires both to hold:** the on-disk files are re-hashed
against the package's own manifest (the root hash, then the identity map for the file
names), and the vendored manifest's digest is compared against the lockfile's `integrity`.
The first catches an edited or missing file; the second catches a manifest that was itself
rewritten. The chain is lockfile → manifest → root hash → identity map.

**A relationship is not a format.** A lockfile, a pin, an install baseline, a divergence
check — these describe what a *consumer* did with a package, a relationship between two
parties, and a format cannot contain a relationship. They stay in the consumer's tree, which
is where this section puts them; they are never part of the package.

### 7.8 Sources and resolution

A source string MAY be given directly, needing no registry:

- `github:acme/team-decisions` — shorthand for the repo's default branch.
- `github:acme/team-decisions/sub/dir#v2` — subpath `sub/dir` at ref `v2`.
- `path:../local/folder` — vendor from the local filesystem.
- `git+https://example.com/x.git#<ref>` *(reserved grammar — see below)*
- `https://…/pkg.tar.gz` — a packaged tarball *(reserved grammar; OPEN: archive signing)*.

**What the reference tool implements today:** `github:` (fetched as a codeload tarball — no
`git` binary required) and `path:`. `git+https`, tarball URLs and bare registry names are
refused with a named error rather than half-supported. A tool is conformant with the forms it
implements; the two reserved forms are grammar this document holds, not behaviour any
implementation currently owes.

**Registry resolution *(OPEN)*.** A bare `name` is resolved via a **registry**: a mapping
from `name` → source. A registry is just an HTTP endpoint returning that mapping; anyone can
host one, and a consumer MAY configure multiple. The wire protocol, name-collision rules
across registries, and trust model are **open**. Registry resolution is a trust boundary
(§7.10).

### 7.9 Versioning *(OPEN — the hard one)*

Semver encodes *behavioral* compatibility, which does not map cleanly onto prose. What does a
"breaking change" to a domain primer mean? Candidate models on the table:

- **CalVer** (`YYYY.MM.MICRO`) — fits "kept current by its source"; used in examples here as
  a placeholder default, **not** a decision.
- **Semver-of-meaning** — major = the claims changed, minor = additions, patch = wording.
- **Content-addressed only** — no human version; the root hash *is* the version.

No model is chosen. This is the single most important open question on the package side.

### 7.10 Security considerations

- **Vendored content is executed by your agent's reasoning, not your CPU** — but it can
  still carry prompt-injection. Treat a freshly added package as untrusted input; review the
  diff like any dependency PR. Integrity proves *what* you got, not that it is *safe* — and
  a seal proves *who* published it, never that it is correct (§6.10).
- **Path safety.** Every payload path MUST be a POSIX relative path that cannot escape the
  package root: no `..`, no absolute paths, no symlinks out. Extraction is sandboxed to the
  package's own directory.
- **Resource limits.** An implementation MAY refuse a package that exceeds size or count
  caps, and MUST fail with a named error rather than truncating or partially extracting.
  Note the consequence: a package can be conformant with this chapter and still be refused.
  The reference tool's caps are **10 000 files**, **32 MiB per file** and **64 MiB total**,
  refused as `too-large`; the per-file cap is applied while reading an archive, so an entry
  that merely *claims* an implausible size is rejected before it is read.
- **Nothing in a package is ever executed** — not at add, not at verify, not at update. Law
  3 names the design; the tool bar below (§7.12) carries it as a hard invariant.
- Registry resolution (§7.8) is a trust boundary; a malicious registry can point a name at a
  hostile source. Name → source mappings SHOULD be reviewable.

### 7.11 The dialects — emit new, read old

This chapter's form consolidates a predecessor envelope (spec name retired; its document
survives in this repository's history). Manifest filenames and digest spellings are
**persisted keys** — they live in trees this standard does not control — so the transition
is governed by one discipline: **an emitter writes the koine form; a reader MUST also accept
the v0 dialect.**

| | The koine form (this chapter) | The v0 dialect (read-only) |
|---|---|---|
| manifest filename | `koine.json` | `pin.json` |
| spec-version field | `koine` | `pin` |
| package integrity | `integrity`: one root hash, `sha256:<hex>` (§7.4) | `contents[]`: per-file entries `{path, media, integrity}` with SRI base64 (`sha256-<base64>`) digests; the manifest itself never listed |
| per-file media hint | the identity map's `format` field (§3.2) | `media` per `contents[]` entry |
| lockfile | `knowledge/.koine-lock.json`, `integrity` = hex digest over the vendored manifest bytes | `knowledge/.pin-lock.json`, `integrity` = SRI digest over the sorted `contents[]` |

Reading the v0 dialect means: accept the old filename and field names; verify per-file
against `contents[]` where no root hash exists; treat SRI base64 digests as valid there —
and only there. A reader encountering **both** manifests in one package MUST refuse it
(ambiguous envelope). Refusal semantics are the spec-version field's (§7.3): a major version
a consumer does not understand is refused, under either name. When emitting the koine form
stops being paired with reading the old one is a future major version's decision, not this
draft's.

### 7.12 The tool *(informative — not part of the format)*

The format does not require any specific tool. The reference CLI surface — the standard's
name is its command:

```sh
# consumer
koine add <source> [--as <dir>]   # resolve + vendor into ./knowledge/, write the lock
koine install                     # restore every package from the lockfile
koine update [name] [--force]     # re-resolve tracked sources to newer versions
koine verify [name]               # re-hash on-disk files vs manifest + lock (offline)
koine list                        # show installed packages and their status
koine remove <name>               # delete a package's directory and lock entry

# publisher
koine init [dir] [--name <n>] [--force]   # scaffold a koine.json (--force overwrites)
koine seal [dir]                          # compute the identity map + root hash, stamp provenance
```

`koine add <name>` by bare name awaits registry resolution (§7.8, OPEN). `koine seal` exists
because integrity hashes cannot be hand-computed — without it nobody can author a valid
manifest.

The same package also exposes the envelope logic as a **library** beside the `koine` binary —
manifest validation, integrity hashing, sealing, verification and the lockfile types, as a
pure core with no filesystem dependency, so a host can speak the envelope without shelling
out to a CLI. That surface is a convenience of this implementation, not part of the format: a
tool in any language that follows this chapter is conformant.

**The tool bar — eight invariants the reference implementation holds itself to.** Not
additional requirements on the format; each is a consequence of this chapter, restated as
something that can be run:

- **U1 — Zero-config.** `koine add` works in a bare repo: no init, no account, no
  configuration. `./knowledge/` and the lockfile are created on demand.
- **U2 — Deterministic.** A git source resolves to an immutable commit SHA before anything
  is fetched, the same lockfile reproduces a byte-identical tree, and the root hash is
  independent of file order.
- **U3 — Idempotent.** Re-adding a package that is already current is a no-op, never a
  rewrite — the lockfile is left byte-for-byte unchanged.
- **U4 — Safe by construction.** Traversal paths, absolute paths, drive letters, symlinks
  and special files are refused; extraction is sandboxed to the package root; size caps
  bound the work; and **nothing in a package is ever executed**.
- **U5 — Local-edit protection.** `koine update` refuses to clobber a vendored file the
  consumer edited, and says so by name; `--force` is the explicit override.
- **U6 — Errors are the product.** Every failure is a typed error carrying both a cause and
  an actionable fix; no stack trace reaches a user.
- **U7 — Offline-tolerant.** `koine verify` and `koine list` are fully offline; a network
  failure during `add` fails fast with a named error rather than a partial vendor.
- **U8 — Fast, quiet, zero-dependency.** The package declares no runtime dependencies,
  output says exactly what changed, and `koine install` restores a damaged tree from the
  lockfile alone.

### 7.13 Host guarantees *(informative)*

The first host implementation enforces several guarantees this document does not require.
They are recorded so a reader comparing spec to implementation does not read them as
undocumented behaviour; none is normative here:

- **Install baseline and divergence check.** Every vendored body is fingerprinted at install
  time, so a later update can *prove* that a consumer edited a vendored file rather than
  guess. A diverged body is never clobbered: it is preserved as an independent copy carrying
  an attribution pointer back to what it forked from.
- **Activation is gated per member class.** Installing never runs anything: an installed
  automation lands configured-but-inactive, an installed workflow lands disabled. Activation
  is a separate, human-approved gesture — Law 3 enforced host-side.
- **Bundle verification is fail-closed.** Package bytes are fetched by content hash and
  rejected unless a recomputed sha256 matches the recorded hash. There is no "hash missing,
  proceed" path.
- **Releases are immutable.** A cut version can never be re-cut or mutated; there is no
  release-update and no release-delete operation.

### 7.14 A complete minimal package *(informative)*

`team-decisions/koine.json`:

```json
{
  "koine": "0",
  "name": "team-decisions",
  "version": "2026.08.0",
  "description": "How our team makes and records architectural decisions.",
  "license": "CC-BY-4.0",
  "readingFloor": 0,
  "source": {
    "type": "git",
    "url": "https://github.com/acme/team-decisions",
    "ref": "a1b2c3d4",
    "subpath": "."
  },
  "provenance": {
    "published_by": "acme",
    "published_at": "2026-08-24T10:00:00Z",
    "method": "git-commit",
    "signature": null
  },
  "integrity": "sha256:9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"
}
```

`team-decisions/conventions.md`:

```markdown
# Conventions

- Never deploy on Friday. See incident #44.
- Every architectural decision gets an ADR in `decisions.md`.
```

`team-decisions/.koine/nodes.jsonl` — the identity map the seal computed (ids minted at
seal), covering both bodies. `readingFloor: 0` declares the bodies self-sufficient: a bare
agent reads `conventions.md` and is done; the sidecar and the papers are for whoever must
*trust* the copy.

### 7.15 The reference import flow — the composition, and what it does not decide

The checks in this standard answer different questions and a consumer needs them composed, in
one order, with one verdict. **A reference implementation SHOULD offer that composition as a
single call**, and this one does (`admitPackage`):

1. **the envelope and the bytes** — readable manifest, root hash, the identity map's listing, and
   the lockfile pin when the consumer holds one (§7.3 · §7.4 · §7.7). A sidecar that does not
   parse refuses here rather than throwing;
2. **required capabilities** (§8.1), *before* any semantic check — a reader that does not
   implement a required capability must not form an opinion about the content at all, because
   its opinion would be the guess §8.1 exists to forbid;
3. **schema and references** — every body against the record type it declares, every edge,
   commit and Locator against what the tree holds (§3.5);
4. **completeness** — no body the package declares `required` is absent (§3.2);
5. **identity** — the package is the one the caller pinned, when one was pinned;
6. **origin** — any seal that travelled verifies (chapter 6). An absent seal does not refuse; a
   seal that was OFFERED and does not verify does. The gate is on offering one at all, never on
   it being honest once offered.

The verdict names the FIRST step that refused and carries every sub-verdict unmodified, so
nothing hides behind the first answer.

**The steps are declared ONCE, in order, and `notRun` is derived from them by
subtraction.** Two lists — a sequence and a set of skippable steps — are two truths that drift:
this one was written as a hand-kept list and reported the wrong set the day a step was added.
A step that is added and forgotten must show up as permanently not-run, never as silently
absent.

**Identity is its own step, and it needs nobody to have vouched.** *Is this the package the
caller expected* is answerable from the manifest alone, so a pinned expectation is compared
whether or not a seal was offered — and compared CANONICALLY, because a subject's key order is
not a fact about which package it names.

**A refusal STOPS the flow, and the steps that did not run are named.** A reader that lacks a
required capability must not go on to judge the content — its judgement would be the guess §8.1
forbids — so the later steps do not run, and the verdict says which. Omitting them instead would
read, at every call site, exactly like a verdict where they passed. **A step that did not run and
a step that passed must never be spelled the same way**, which is §3.5's rule for verdicts applied
to a sequence of them.

**A malformed artifact is a verdict, not an exception.** A sidecar that does not parse yields a
refusal with a step and reasons; a thrown error has neither, and every catch site invents its own
meaning for it.

**What it does not decide, stated because a composed `true` invites the assumption:** admission
is not activation. Whether the publisher is trusted, whether the licence permits the use, what
the declared status source says today (§7.3 — fetching it is the consumer's act, not the
format's), and whatever the domain requires on top are the application's, and no verdict here
speaks for them. **Not every function must do every job; no function's result may suggest a
success wider than the question it asked.**

## 8. Extension profiles

A vendor MAY carry facets this specification does not declare, inside a record type's JSON
Schema document, as **document-root keywords named `x-<vendor>-*`**. A foreign reader MAY
ignore any such keyword and MUST NOT reject a document for carrying one — JSON Schema's own
extension rule, adopted rather than reinvented.

The reference implementation registers its keys under `x-noebase-*`; **the authoritative
list of them lives with that implementation, not here, and this document never enumerates
it** — a profile's key set grows on its owner's clock, and a list frozen into a
specification is stale by its next release. Naming the namespace says exactly what it is:
**a vendor extension profile, not core semantics.** Nothing in §1.3's core depends on any
`x-` keyword; two implementations that share no profile still exchange types, and each keeps
whatever it could not express in the other's vocabulary.

Three consequences worth stating, because each has already been gotten wrong once:

- A record type's dictionary entry stays `{name → types/<name>.schema.json}` (§2.1), and the
  file is a JSON Schema document with no sibling facet keys beside it. Anything a vendor
  declares beyond plain JSON Schema — storage facets, display facets, profile hints — rides
  *inside* that document under its extension namespace.
- An extension keyword is scoped to its vendor's own meaning. Two vendors MAY use the same
  word for different subjects, and a reader MUST NOT unify them by name. **The live example,
  because it is one word over two subjects:** a profile keyword spelled `provenance`
  *inside* a record type's schema document says where a field's value is derived from — it
  is **not** the kind dictionary's top-level `provenance` (§2.1), which is the custody trail
  of who defined that kind. Same word, different grain, different subject; neither implies
  the other.
- Everything a vendor wants *other* implementations to honour belongs in the core, proposed
  as a spec change — never in a profile. A profile is where a vendor keeps what is its own.

### 8.1 Required capabilities — the must-understand half

The `x-` surface above is **ignorable by construction**, and §7.5 makes carrying-without-
understanding explicitly legal. That is the right rule for an optional facet and the wrong
one for a mandatory one: a profile that cannot say *you must honour this or refuse me* is not
an extension mechanism, it is a suggestion. This section is the other half.

An artifact MAY declare **`requires`** — a list of **capability tokens** a consumer must
implement to read it faithfully:

```jsonc
"requires": ["absent-body", "org.acme.retraction"]
```

- **Package grain:** the `requires` field of `koine.json` (§7.3).
- **Tree grain:** `.koine/requires.json` — `{"koine": "0", "requires": [...]}`, tokens sorted.
  The file exists only when something is required, so no tree that demands nothing changes.
- **A core token** is lowercase and hyphenated and is registered in the table below. **A
  vendor token** is reverse-DNS (`org.acme.thing`) and is never registered here — a profile's
  key set grows on its owner's clock. The two namespaces cannot collide: a core token has no
  dot, a vendor token has at least one.

**The rule (normative).** A consumer reading an artifact that declares a capability it does
not implement **MUST refuse the artifact** — not import it, not materialize it, not answer
from it — and MUST say which capability it lacks. A consumer that logs a warning and
continues has implemented the warning, not the rule. `requires` is also the one accompanying
manifest field a validator MUST parse rather than carry through (§7.3): a `requires` a reader
cannot parse is one it cannot honour.

**The registered core capabilities.**

| token | what implementing it means |
|---|---|
| `locator` | resolve an endpoint Locator (§3.4), and report a stale one rather than a region |
| `absent-body` | read a node row marked `absent` (§3.2), and refuse to activate on a `required` one |
| `status-source` | read a package's declared status source (§7.3), and render an unreachable one as possibly-stale |

**Some facets are mandatory to declare when used; most are not.** The discriminator is what a
reader that ignores the facet concludes. Ignore `state`, the commit `node` binding or the
four-verdict result and a reader under-reads and knows it. Ignore `absent` and it concludes
**it holds every body** — a confident wrong answer. So a tree carrying an `absent` row and
not requiring `absent-body` is **malformed**: an emitter MUST refuse to write it and a parser
MUST refuse to read it. `locator` and `status-source` are a producer's choice, because
ignoring a Locator widens *supports page 14* into *supports the document* — a loss of
precision, not a false statement.

**The moment to add this mechanism was before a second profile existed.** Every interchange
format that survived multi-party use grew one — JWT/COSE `crit`, OCI `artifactType`, JSON-LD
`@protected` — and each grew it late, when every existing profile had already become a
compatibility constraint on it. The model here is `crit`'s: a flat list of fine-grained
tokens, so a reader refuses precisely instead of refusing a whole profile it mostly
implements.

**This is also how richer semantics stay out of the core without closing the door.** A full
ontology, an inference profile, a domain's own status axes — all possible, none core. They
enter as a profile that declares itself required, and a reader that does not implement it
refuses honestly instead of importing and guessing. **The core carries anything and
understands exactly one thing: what the things are and how they relate.** A second understood
thing is where adoption stops.

## 9. *[Reserved]* The verbs

This chapter is reserved and deliberately empty. Its subject is the travel form of the
**standing processes** a workspace declares — the loops, workflows and checks that today
stay home when the knowledge they govern travels.

The direction is recorded so the reservation is not a blank: schedules as **RRULE**
(RFC 5545, with `DTSTART;TZID`; cron accepted as input sugar that normalizes into RRULE),
composition as a **task-list shape** (steps as data: action, input, condition, retry —
bindings vendor, composition portable via chapter 8's core/profile split), check vocabularies
under the **closed-vocabulary-plus-quarantined-escape** discipline the data-contract field
proved out. Declarations travel; engines never do — exactly as a record type travels without
its database.

The chapter fills under this standard's own discipline: **it publishes nothing its editors
do not themselves use in full.** The verbs' chapters are written when the reference
implementation round-trips them at its boundaries — not before, and not on demand.

## Annex A — Mappings

The annex holds **adapters, one page each**: how the koine form maps into and out of a named
foreign shape. Annex pages are additive — the annex grows without re-cutting the chapters —
and every page is one-way honest: it states what the target cannot carry, instead of
pretending the mapping is lossless.

### A.1 The adapter page form

Every adapter page answers one table, one row per mapped type:

**Kind × Target → (path · format · merge · name-fidelity)**

- **path** — where in the target's layout the rendering lands.
- **format** — the target-side file shape the rendering takes.
- **merge** — what a re-render does to target-side edits: `replace` (the rendering is
  derived, one-way out), `merge`, or `propose` (changes come back as chapter-5 proposals,
  never as silent writes).
- **name-fidelity** — whether the source's declared names survive: `verbatim`, `transformed`
  (stated rule), or `lost` (the target has no slot; the page says so).

A rendering into a target is a **projection** — derived, one-way, never a second source of
truth. The return leg, where a target supports one, arrives as proposals (chapter 5).
Per-target pages (agent harness layouts among them) are added as their reference
implementations ship; the form above is normative for every page.

### A.2 OKF — `status` and `sources[]`

Google's Open Knowledge Format (v0.2) carries asserted lifecycle and provenance:
`status: draft | stable | deprecated` (absent ⇒ `stable`, unattributed) and `sources[]`
(per-source entries — `resource` required; `id` · `title` · `author` · `usage_count` ·
`last_modified`).

**Export (koine → OKF), one-way:**

| koine | OKF |
|---|---|
| `draft` | `status: draft` |
| `valid` | `status: stable` |
| `frozen` | `status: stable` |
| a `frozen` node with a successor edge | predecessor exports as `status: deprecated` |
| attributed history (§3.3) · `derives-from` edges | `sources[]` entries |

The mapping is lossy by construction and the page says where: OKF's flags are unattributed —
the *who* and *why* of every promotion (§4 rule 1) do not survive; the chain does not
travel; trust tiers are readable, never checkable. An importer reading OKF SHOULD land
`stable` content as `draft` (assertion is not promotion) and record `sources[]` as
derives-from edges.

**The ride (OKF ← koine sidecar):** an OKF bundle's frontmatter is body bytes to koine
(§1.4 rule 1) — a `.koine/` sidecar beside an OKF bundle adds identity, integrity, history
and provable origin without touching a byte the OKF reader sees. Note the asymmetry the ride
exposes: metadata *in* frontmatter cannot carry a per-document hash without hashing itself
(circular); metadata *beside* bodies can.

### A.3 The skills ride

Agent skill folders (`SKILL.md` + resources; the Agent Skills convention) are a prose
instruction format by design — no types, no hashes, no history, and deliberately so: the
body is for the model.

Because bodies travel verbatim (§1.4 rule 1), **a `.koine/` sidecar beside `SKILL.md` is
invisible to every skill reader** — Claude, Codex, Copilot or Gemini load the skill exactly
as before — and adds what the convention cannot express: stable identity across renames,
per-file integrity, attributed history, and provable authorship (chapter 6) including the
delegation certificate for agent-authored skills. A skill folder so described packages like
any other tree (chapter 7): *a skill you can trust is a skill with a koine sidecar.*

No mapping table is needed in this direction — the ride adds, it does not translate. The
translation direction (a kind rendered *into* a skill folder) is an adapter page under A.1.

### A.4 ODRL — the rights-world mapping *(informative)*

[ODRL 2.2](https://www.w3.org/TR/odrl-model/) (W3C Recommendation) is the rights-expression
base of the media world; a koine `terms` entry maps onto it mechanically, so a consumer that
already speaks ODRL can translate rather than parse twice. The package is the policy's
`target` (per-entry globs become member IRIs at translation time); `permits` / `prohibits`
become `permission` / `prohibition` over `use`-class actions; a priced `payment` becomes a
`compensate` duty carrying `payAmount` plus its currency; `attribution` becomes an
`attribute` duty. The mapping is one-way and informative: ODRL requires IRIs where koine
uses package-relative paths, and its conformance rule — halt on an unknown profile —
contradicts §7.5's carry-verbatim law, which is why ODRL is a mapping here and not the base.

## Declared gaps

**The working record is [`REGISTER.md`](REGISTER.md).** This list stays because a number in a
published document must keep resolving — every gap below keeps its number forever, closed or
not — but it is not where an open delta is worked. A hand-written list with no dates, no
status and no receipt cannot tell a gap that is being worked from one that has been forgotten,
and for a year it did not.

1. **Edge grounding — CLOSED 2026-09-17.** *How a declared edge relates to (absent) textual
   anchors in the bodies* is answered by the **Locator** (§3.4): an endpoint carries the
   version it addressed and, optionally, one of six closed selector types. The number stays
   so older references keep resolving. What remains open beside it, and is NOT this gap: how
   a selector is expected to degrade for a format this document has not measured — a new
   format's row in §3.4's table is written when a producer round-trips one.
2. **Seal payload enumeration + conformance vectors — CLOSED 2026-09-17.** §6.4 enumerates
   the payload, §6.7 the delegation certificate, and `test/vectors/seal-v0.json` carries the
   conformance cases. The number stays so older references keep resolving. **Why the original
   plan could not have worked**, recorded because the shape recurs: the gap said the
   enumeration would be *extracted from the reference implementation's test vectors*, and that
   implementation signed a **different envelope** from the one this chapter declares — so
   there was nothing to extract, and the gap was waiting on an event that could not occur.
   A gap whose closing condition is an extraction should name the artifact it will extract
   FROM, and check that it exists.
3. **The format dictionary.** The fourth dictionary has no sidecar file kind; a body's
   format travels as a field of its identity-map row (§3.2). What a format declaration
   would consist of is open.
4. **The custody vocabulary — and its grain.** `provenance` (§2.1) is carried verbatim, and
   this document **deliberately declares no vocabulary** for who-defined-this and
   under-what-seal: an emitter records what its definer recorded, and inventing a schema for
   custody ahead of the seal fixtures (gap 2) would fix the wrong shape early. Two things
   stay open, and neither is answered here: what that vocabulary should be, and **custody at
   record-type grain** — a kind carries its custody, a record type has nowhere to put one,
   and no home is invented for it in this version.
5. **The terms pricing grammar (§7.5) — CLOSED 2026-08-27.** The research pass ran (RSL 1.0
   read at source · ODRL 2.2 weighed and mapped in Annex A.4 · the x402 quote seam checked)
   and §7.5 froze the grammar. The number stays so older references keep resolving.
6. **Package-side opens, carried from the envelope's own draft:** versioning semantics
   (§7.9 — the hard one) · registry protocol and multi-registry trust (§7.8) ·
   `representations` (§7.3) · tarball/sourceless distribution and archive signing (§7.8) ·
   whether a package may depend on another package, and how that resolves.

---

## Changelog

### 2026-09-17 (the query pass) — three defects nobody reported

**Not a review round. This one is ours.** Four rounds of outside review had produced fifteen
findings, and the fourth round's own lesson was that *a reported defect is a shape, not a site*.
The honest reading of that lesson is uncomfortable: the shapes had been run as queries **only
over the code the report pointed at**. Before asking anyone to read a fifth version, the two
standing shapes were run over the whole source — *where is something checked against a value its
own caller supplied* (rule 3) and *where does one rule have more than one enforcer* (rule 5).
They found three, none of them reported, two of them introduced by our own repairs.

- **The Locator's resolver took the actual hash from its caller.** `resolveLocator(locator,
  body, actualHash)` — publicly exported since 0.5.0. A caller passing `locator.contentHash`
  gets `resolved` for every pointer, forever, and the result says nothing; `stale` is the entire
  point of the required `contentHash` and this is the one input that can make it unreachable.
  Identical in shape to the seal-of-A-vouches-for-B finding of the second round (B8), in a
  chapter the reviewer had no reason to probe. §3.4 now requires derivation, and the reusing
  variant is named `resolveLocatorAgainst` — **an API break against 0.8.0**, deliberately, so
  that the reuse is legible at the call site rather than hidden in a third argument.
- **The state law had acquired a second enforcer — in the repair that closed its first hole.**
  The round-2 finding *the seal drops the state* was closed by teaching `sealPackage` to read the
  shape block. `emitKoineTree` already did. Two copies, and they had already drifted in their
  handling of a body that declares one state while the emitter is told another. §4 now states the
  resolution once and both boundaries call one function.
- **The actor grammar was written three times, at three strictnesses.** The seal required a
  non-empty id, the proposal receiver tested the prefix only, and `commits.jsonl` did not check
  at all — while §3.3 declared the grammar normative for exactly that field. Measured: the actor
  `actor:user:` was a valid proposer and an invalid seal author; `bob` was a valid commit actor
  and invalid everywhere else. One predicate now, used at all three grains.

**What this changes about the relationship, which is the part worth recording.** A standard
whose defects are all found by its readers has outsourced its verification to people who owe it
nothing — and four rounds in a single day is a reviewer spending more hours on this document than
its editors were spending on the repairs. The query pass costs a fraction of a review round and
runs against the whole source rather than the reported site. It belongs before a release, not
after a report.

### 2026-09-17 (fourth round) — the shape of a repair, and the query it should have triggered

All five findings of the third round verified fixed by the reviewer. Three more, all P2, and
their common property is the one worth recording: **two of the three were introduced by the
previous round's repairs, and the third was a rule written into this document and implemented at
one of its five steps.**

- **An expected package identity was compared only in company.** `expectedSubject` was checked
  inside the seal branch, so a caller who pinned an expectation and offered no seal had it
  silently ignored — an option contract promising a comparison and delivering one conditionally.
  Identity is now its own step in §7.15: *is this the package the caller expected* is answerable
  from the manifest alone.
- **That comparison was order-dependent** — raw serialized equality, written the same day the
  canonical one was introduced three files away. §2.2's rule now reads at the subject too.
- **A missing field and a `null` one became equal.** The third round's canonicalization repair
  made `undefined` render as `"null"` — correct inside an array, wrong as an equality — so a
  proposal ADDING a field as `null` was read as changing nothing. §2.2 states it: absence is
  answered before values are compared.
- **The stop-on-refusal rule was applied at one step of five**, and the single early return
  overwrote the earlier refusal it was meant to preserve. §7.15 now declares the steps ONCE and
  derives `notRun` by subtraction, so a step that is added and forgotten shows up as permanently
  not-run rather than as silently absent.

**What the round taught beyond its own findings, recorded because it is now the fourth
occurrence.** A reported defect is a SHAPE, not a site. Running the third round's two shapes as
queries over the whole source — *where else is equality serialized?* and *where else is a rule
applied at one site?* — found the reported instance **and one the review could not have seen**: a
seal's own subject comparison, reachable only by a foreign producer, which would have refused a
valid seal from a second implementation that serialized the subject's keys in another order. That
is an interoperability defect in precisely the path a second implementation proves itself
through, and it was found by asking a question rather than by reading a report.

### 2026-09-17 (third round) — the defect in the repair of the repair

The second round's repairs shipped as 0.7.0. The same reviewer returned within hours with **five
more findings**, two of them P1 — and the two P1s were in code written that afternoon *to close
the composition hole the second round reported*.

- **A genuine seal over package A admitted package B.** `admitPackage` accepted the seal's
  SUBJECT from its caller and never bound it to the package it had just read. The crypto was
  sound; the composition simply never connected the claim to the artifact. §6.3 now says it
  normatively: **a verifier DERIVES the subject and MUST NOT accept one**, because a seal checked
  against a handed-in subject proves that *some* package was signed, never that *this* one was.
  The API no longer has the field.
- **Canonicalization silently dropped a legal JSON key.** The projection accumulated into a `{}`,
  and assigning `__proto__` sets a prototype rather than an own property — so two manifests that
  differ produced one digest and a real signature stayed valid across a real change. The repair
  is not *handle `__proto__`*: the canonicalization now **serializes directly from sorted pairs**,
  with no object model between the data and the bytes, because a canonicalization whose
  correctness depends on which key names the host treats as special is not canonical.
- **The actor grammar was never checked** (§6.7): a mandate signed by another *agent* was accepted
  — a chain of mandate with no person at the end of it — an author that was not an actor at all
  passed every prefix test, and a missing author threw. Structure is established before semantics
  now, and each case has a named refusal.
- **A version suffix was parsed and then ignored**, so `metric@v999` resolved to `metric@v0`. A
  suffix that is read and discarded is worse than one that is not read: it reads as agreement.
- **The documented order was not the implemented order.** §7.15 said capabilities refuse *before*
  any semantic check and the code ran them anyway; a malformed sidecar escaped as an uncaught
  parse error. Both repaired, and the chapter now states the rule the omission taught: **a step
  that did not run and a step that passed must never be spelled the same way.**

**The pattern across all three rounds, since it is now measurable.** Of twelve findings, **six**
are one shape — a verifier trusting a fact it should have derived — and **four** are another —
two representations of one fact with nothing holding them together. Both are recorded as rules in
[`REGISTER.md`](REGISTER.md), and the negative population they imply now ships as a declared
category of conformance vector rather than as this project's own positive fixtures.

### 2026-09-17 (later the same day) — what an outside review found in the repair

0.6.0 shipped in the morning. By the afternoon the project that had reported the first round had
re-read the published distribution against the registry checksum and returned **seven further
findings**, every one reproduced. Six are repaired here; the seventh is answered as a contract.

**All of them lived BETWEEN the pieces, and that is the lesson worth keeping.** Each function
was green. Each law was proven where it was written. The suite had 212 passing tests.

- **The package seal dropped the meaning it was handed.** `sealPackage` rebuilt the identity map
  from the files on disk and kept four fields, so `state` died at the package boundary and rows
  declaring an **absent** body vanished entirely — they have no file for a walk to find. A frozen
  slice of five bodies admitted three; the same tree sealed and re-exported admitted all five,
  **including the draft the gate had refused**, and a package missing a `required` piece of
  evidence then verified `ok`. §7.4 now requires preservation, a body that contradicts its own
  row is an error at seal, and a declared absence is reported as *incomplete* rather than as
  drift or as nothing. **A law with two enforcers is a law with a hole in it.**
- **An agent author with no mandate verified.** `verifySeal` checked the delegation certificate
  *if one was present*. §6.7 now requires it for any `actor:agent:` author, because an absent
  mandate is not a satisfied one — the same shape as a `null` origin verdict, one layer down.
- **The package signature did not bind the papers.** The subject was `{name, version, integrity}`
  and the root hash excludes `koine.json` (§7.3), so `license`, `source`, `terms`, `requires` and
  `status` sat outside the signature — while §7.5 stakes the whole tamper story of the priced
  half on `payTo` being *inside the sealed papers*. The subject now carries **`papers`**, a digest
  over the manifest less its own signature field, with sorted keys because a manifest is
  re-serialized by whoever reads it.
- **Nothing composed the checks.** A required capability could be *named* by `checkCapabilities`
  and never *refused* by any verification. New **§7.15** documents the reference import flow —
  integrity, then capabilities *before any semantic check*, then schema and references, then
  completeness, then origin — naming the first step that refuses and carrying every sub-verdict
  through. And saying what a composed `true` does not mean: **admission is not activation.**
- **The proposal ignored its own declarations.** The `schema` id was never read, so a proposal
  naming a record type that does not exist received `ready`; and acceptance wrote back to the
  path the proposal was *drafted* against, so a renamed document — which resolves correctly by id,
  since an id outlives a path — got a stale twin while the real body went untouched. Both are
  refused now, and the receipt reports the resolved target and whether it moved.
- **A boolean is a schema**, and the validator treated one as *nothing to check* — inverting
  `not`, `properties` and `items`, two of them failing open. `const` and `enum` also compared
  serialized key order, so an object `const` rejected the very object it names.
- **B7, answered as a contract rather than a patch.** A record schema arriving with its own
  `$id` had it silently replaced by `koine/types/<name>@v0` on the next emit. §2.1 now says what
  was always true and never written: **the FILENAME is the binding** (§2.2 resolves `kind:` to a
  path, never to an `$id`), so koine stamps only where a document carries none, and a reader
  strips only the stamp koine itself wrote.

**What did not change, and was asked about:** the conformance suite shipped in 0.6.0 is an
UPSTREAM test written on the basis of external criteria. It is not a passed acceptance and it is
not a second independent implementation, and the register now says so in those words — borrowing
a reviewer's criteria does not borrow their independence.

### 2026-09-17 — the seal: chapter 6 closes, and the gap's own plan is corrected

**Declared gap 2 closes.** §6.4 enumerates the seal payload, §6.7 enumerates the delegation
certificate, and conformance vectors ship with the reference implementation.

The gap's closing condition was *"extracted from the reference implementation's test vectors,
not authored ahead of them"* — and **the extraction could never have happened.** The
reference implementation had a live, coherent BIP-340 signing path that implemented a
different envelope from this chapter: `sha256(canonicalJson(subject))`, with `method` and
`pubkey` outside the signed bytes. §6.4 asks for DSSE and for both facts inside the
authenticated payload, and gives the reason — DSSE's `keyid` is an unauthenticated hint that
MUST NOT be used for security decisions, and DSSE carries no algorithm field at all. So there
was nothing to extract that matched, and every month spent waiting was a month three
unrelated roads stayed blocked behind this chapter. **A gap whose closing condition is an
extraction should name the artifact it will extract FROM, and check that it exists.**

- **§6.4** enumerates the payload: `koine` · `kind` · `method` · `pubkey` · `npub` · `author`
  · `signedAt` · `subject` · optional `delegation`, all inside the signature. The subject has
  the three grains of §6.3. The signed message is `sha256(PAE(payloadType, payload))`, 32
  bytes, with `PAE` exactly DSSE 1.0.2's.
- **There is no canonicalization rule, deliberately.** DSSE authenticates the payload as raw
  bytes, so two implementations agree on what was signed by construction — no sorted-key
  discipline, no RFC 8785, nothing to get subtly and silently wrong. The delegation
  certificate is a DSSE envelope for the same reason: bytes all the way down.
- **§6.5** says what §3.5 says at a finer grain: a verdict that is merely `false` cannot be
  acted on, so a refusal names its step. And step 1 **recomputes** the subject from content —
  a verifier that read it off the seal would be checking the seal against itself.
- **§6.7** enumerates the certificate and states the two bindings a verifier MUST check: the
  certificate's key is the key that signed THIS seal, and its agent is the author THIS seal
  claims. Without the first, a certificate minted for another agent can be pasted on.

**The curve is not this package's.** Everything the FORM owns is implemented here — the
pre-authentication encoding, the payload enumeration, the subject binding, the delegation
chain — and the curve operation is injected, so the package keeps its zero-dependency
property and §6.5's *"~50 lines in any language"* stays a description rather than a slogan.

### 2026-09-17 — the receiver: the day-one gesture gets an implementation

Chapter 5 declared receipt semantics **normative**, in five ordered steps, and shipped a
schema and a worked example. `grep -rni proposal src/` returned **one comment**. There was no
receiver, no apply path and no fixtures, on either side of the boundary — so a package could
be read and never answered, and nobody could check anyone's conformance to the chapter, these
editors included. **A normative MUST with no reference implementation is not normative; it is
a wish.**

- **The receiver ships**, all five steps in order, and it never writes: receipt produces the
  conflict list, acceptance is a separate act. A receiver that applied as it read would make
  step 5 unobservable.
- **The two classifications are now mechanical.** A change whose `from` still equals what the
  holder has is no conflict. Where they differ: if either candidate makes the resulting shape
  fail its record type the shape has convicted one of them — **`one-is-wrong`**, no human
  needed; if both are legal, **`both-intentional`**.
- **`changes[].from`/`.to` are arbitrary JSON.** The v0 schema admitted strings only while
  `resultingShape` carried general JSON, so a change to a number or a nested object was
  unexpressible in the diff that is required to EQUAL it. An **omitted** `from` or `to` now
  means the field is absent on that side — an addition or a removal — and `null` stays the
  JSON value null; JSON cannot write *not there* as a value, so the key's presence carries it.
- **A second grain: the body proposal.** `target` may carry a `selector` (§3.4), and a change
  whose `field` is the reserved name `body` replaces the addressed region. This closes a real
  impasse: the envelope was field-grained and a live editor's proposal is a text range, so
  *the day-one gesture and the day-one gesture could not express each other.* One reserved
  name keeps the diff field-wise, which is Law 2's shape, while letting an end land on prose.
- **Acceptance binds its commit to the node it touched** (§3.3's `node`), so the ritual the
  chapter describes is verifiable rather than asserted. An accepted proposal is thereafter
  stale against the tree it was applied to — which is how a second holder learns not to apply
  it twice.

A second worked example ships beside the first: `examples/proposals/paused-members-wording.proposal.json`,
the body grain, received and accepted against the example tree in this package's own suite.

### 2026-09-17 — the verdict: must-understand, and a package's honesty about itself

**koine's only extension shape was ignorable by construction.** §7.5 makes carrying-without-
understanding explicitly legal — the right rule for an optional facet, the wrong one for a
publication or retraction rule a receiver must honour or refuse. There was no `requires`, no
crit-list, no artifact-type discriminator, so a profile could only suggest.

- **New §8.1, required capabilities.** An artifact declares `requires` — a flat list of
  capability tokens, `crit`'s model — at package grain (`koine.json`) or tree grain
  (`.koine/requires.json`). A consumer that does not implement one **MUST refuse the
  artifact and name what it lacks**. Three core tokens are registered: `locator`,
  `absent-body`, `status-source`. `requires` becomes the one accompanying manifest field a
  validator MUST parse rather than carry through — a rule a reader cannot parse is one it
  cannot honour. The `x-` surface is untouched and stays the optional half; the two mechanisms
  never collapse.
- **A package can say what it LACKS.** `nodes.jsonl` gains **`absent`** (§3.2): this body is
  referenced and not carried, optionally with a reason, optionally `required` — and the row
  keeps the absent body's digest, which is what makes it a declaration rather than a note.
  Previously a package could reference a body it did not carry only by leaving it out, which
  is indistinguishable from not referencing it at all. **A tree using it MUST require
  `absent-body`**: emit refuses to write one that does not, and parse refuses to read it,
  because a reader ignoring the key concludes it holds everything. Verification asks the
  opposite question — the tree must NOT carry what it declares absent.
- **A package can say where its own STANDING is published.** `koine.json` gains **`status`**
  (§7.3), an absolute URL, with a three-field document and the reader's rules: an unreachable
  source renders as *possibly-stale*, never current; `withdrawn` removes the package from the
  consumer's answer context, not only from its shelf. *Offline verifiability of an old package
  does not prove it may still be used today.* The revocation **service** stays outside the
  standard — the form owes a declaration, never a mechanism.

Both declarations were deliberately written after §8.1 rather than beside it: carried as
ignorable `x-` extensions they would have been exactly the unsafe shape that section exists to
close.

### 2026-09-17 — the roundtrip, and the Locator

**The form's own laws did not survive its own roundtrip, and an outside assessment found it
before this project did.** Four defects with one cause — the boundary dropped what makes
knowledge usable — plus the shape that made knowledge ABOUT something unable to travel at
all. Each is now a field rather than a sentence:

- **Validity travels.** `nodes.jsonl` gains **`state`** (§3.2). It was specified in chapter 4,
  applied at emit, and written into no field: `parse → emit({frozenSlice})` yielded **zero
  bodies**, and the reference implementation lived with `frozenSlice` switched off at both
  ends because of it. A law enforced at a chokepoint the artifact cannot express is a call
  parameter, and chapter 4 now says so in those words.
- **The §7.6 contradiction is resolved, in favour of §7.6.** An absent `state` and a declared
  `"spoken"` are different facts; `state ?? "spoken"` collapsed them and gated out the
  undeclared bodies §7.6 says travel. Chapter 4 rule 4 states both tests explicitly.
- **A frozen slice is a whole artifact** (chapter 4, rule 5). History bound to an excluded
  body no longer travels, surviving commits renumber from `seq: 1` with the chain recomputed,
  and an emitter refuses a slice whose surviving sidecars still spell an excluded id.
- **History binds to the tree it remembers.** `commits.jsonl` gains **`node`** (§3.3), and
  `what` is declared prose that a conformant reader never parses as an identifier. The
  binding previously had nowhere to live but `what`, where no foreign reader can tell an id
  from a sentence — which is also how it crossed the frozen-slice gate.
- **Verification answers four questions** (new §3.5): integrity · schema · references ·
  origin, each `pass` / `fail` / `not-established`. Two of the four had no implementation:
  nothing ever opened a body against the dictionary the tree itself carries, and an unsealed
  tree reported the same verdict a sealed one did. §2.2 declares the JSON Schema subset a
  conformant validator asserts on, and the coercion rule without which no record type with a
  non-string field was declarable in a shape block at all.
- **The Locator** (new §3.4) — an edge endpoint may address a PART of a body and says which
  version it addressed: a required `contentHash` plus one of six closed selector types, each
  with prior art and a measured degradation. **Declared gap 1 (edge grounding) closes.**
  Beside it, `edges.jsonl` gains the facets that make an assertion one — `actor`, `when`,
  `validFrom`/`validTo` — and **`weight`**, the instance carrier for semantics the edge type
  dictionary has declared since this document's first version and no travelling edge could
  ever carry.

**No byte changes to a tree that used none of this.** Every field above is omitted when
absent (§1.4), so a tree written before this revision re-emits byte-for-byte unchanged.

### 2026-08-27 — the terms grammar freezes

Declared gap 5 closes: §7.5's reserved `terms` block becomes normative. The grammar is
authored — RSL defines no JSON carrier, so adopting one was never on the table — and takes
its enumerated vocabulary from RSL 1.0 by citation (the payment types minus the two
stateful ones; the usage/user/geo axes), owns POSIX package-relative glob addressing (the
half-cell that justified the block), and carries exactly what an x402 quote needs (`payTo` ·
`network` · `asset` · a decimal price). Default free at every level; document-order
precedence; carry-verbatim stays legal for every consumer that does not act on terms.
ODRL 2.2 becomes an informative mapping (new Annex A.4). No sidecar byte changes; a package
without the block is byte-identical to before.

### 2026-08-24 — the consolidation re-cut

One standard, one document. The package envelope (formerly a sibling specification) and the
seal (formerly a chapter-in-waiting) are folded in; the document is re-cut into nine chapters
and one annex. The form version stays `v0`; no sidecar byte changes. In detail:

- **The section map (old → new):** §1 → ch 1 (§1.1–§1.2) · §1.1 → §1.3 · §1.2 → §1.4 ·
  §2 → §1.1 · §3.1 → §3.1 · §3.2 → §2.1 · §3.3 → §3.2 · §4 → §3.3 · §5 → §1.5 · §6 → ch 5 ·
  §7 → ch 6 · §8 → ch 4 · §9 → §2.2 · §10 → ch 8 · §11 → Declared gaps · §12 → absorbed
  into ch 7. The floors keep their numbers — they are concepts, not sections.
- **O3 ratified by keeping (2026-08-24).** The normative-scope split (§1.3: core vs tree
  profile) is no longer marked provisional.
- **H1 ratified: one digest spelling for the standard — `sha256:<hex>`** (§3.2, §7.4). The
  sidecars already used it; the envelope now does too, in the BagIt/WACZ lineage, adopted by
  citation. SRI base64 survives only where the v0 package dialect is read (§7.11).
- **Chapter 7 folds the package envelope in as a composition profile.** The six shipping
  papers stay the irreducible set; the manifest is `koine.json` with spec-version field
  `koine`; `contents[]` is replaced by **one root hash** over the canonical tree listing
  (§7.4 — the reduction the runnable falsifier proved), with the per-file spelling and
  chain shape cited from BagIt RFC 8493 / WACZ 1.1.1; the lockfile is
  `knowledge/.koine-lock.json` pinning the vendored manifest bytes. **Filenames and digests
  are persisted keys: §7.11 binds every reader to the v0 dialect (`pin.json` · `pin` ·
  SRI `contents[]` · `.pin-lock.json`) — emit new, read old, never a silent break.** The
  predecessor document's still-open questions carry into §7.9 and Declared gaps; its U1–U8
  invariants carry verbatim as the tool bar (§7.12), under the tool's one name.
- **Chapter 7 requires the identity map in a package** (§7.2): the envelope's WHICH-file
  conviction reads it, and a sealing tool computes it from a bare tree (ids minted at
  seal). The v0 dialect carried per-file hashes in the manifest instead; reading it stays
  owed (§7.11).
- **The manifest gains `readingFloor`** (§7.3): which floor faithful consumption requires —
  the one fact not derivable from the tree. Optional; absent reads as before the field
  existed.
- **The terms paper is composed** (§7.5): `license` = an SPDX license expression (adopted
  atom); the priced half is a reserved `terms` block — RSL vocabulary over
  **package-relative addressing** (the half-cell RSL's robots-path binding leaves open),
  grammar frozen only after the pricing research pass (Declared gaps 5).
- **Chapter 6 is now the seal's full chapter.** Carried from the v0 signing draft: binding
  points, the offline verifier, the identity anchors, revocation honesty, the honesty law.
  New: the audience section (§6.1 — who must trust text they did not write, with the
  Art. 50 referent), the **DSSE-compatible envelope profile** (§6.4 — signature over the
  PAE; method and key inside the authenticated payload, because DSSE's `keyid` is an
  unauthenticated hint and DSSE has no algorithm field; BIP-340/npub rides under DSSE's own
  no-algorithm-restriction rule), the **delegation certificate named as authored** (§6.7 —
  absent from DSSE and WACZ, structurally impossible in C2PA's X.509-only model), and the
  **sealed receipt** (§6.8 — a bounded, attestation-compatible claim that never amends the
  honesty law).
- **Chapter 4 rule 4 states the gate's edge exactly:** declared-below-`valid` never enters;
  an undeclared (`spoken`) body is outside the gradient's gate and travels as an utterance.
  Both donor texts already held one half each (the gradient gates the boundary; a bare tree
  packages); the fold forced the seam to be written down.
- **Chapter 9 is reserved in the open** — the verbs' direction recorded (RRULE schedules ·
  task-list composition · closed check vocabularies), filling only when the reference
  implementation round-trips them.
- **Annex A opens** with the adapter page form (**Kind × Target → path · format · merge ·
  name-fidelity**; renderings are projections, returns are proposals), the OKF mapping page
  (`status`/`sources[]`, lossy where OKF is unattributed), and the skills ride.
- **"Koine repo" → "koine tree"** throughout — the noun aligns with the tree profile's own
  name and with carrier freedom (§1.2); "repo" implied one carrier. Frozen example bodies
  keep their bytes (a body is a body).
- The previous revisions' entries below reference the pre-consolidation section numbers and
  sibling documents; they are the historical record and stand as written.

### 2026-08-07 — the v0 truth-up

- **§1 rewritten to say what the missing layer is.** The substrate knowledge lacks is
  **declarable**, not diffable; the earlier framing argued from diffability and answered the
  wrong question. Comparisons to code tooling are derivation, not framing, and are not made here.
- **§1 states the form's carrier-freedom** (a form fills a cell, it does not occupy one; no
  transport is prescribed).
- **§1.2 added** — bodies-travel-verbatim and canonical emission are now explicit normative
  rules with their mechanical reasons, rather than a law-list entry and an unwritten convention.
  Canonical emission was previously nowhere in this document while being the precondition for a
  second implementation existing at all.
- **§1.1 added — the normative-scope split** *[O3 — owner ratifies by keeping; reverting to the
  flat three-floor structure is Option 2].* The core is the four dictionaries plus the §9
  shape-block binding; identity map, edges and the memory floor are specified as **the koine tree
  profile** that the package side requires of its payload (§12). **No normative content was
  removed or weakened** — the sections were re-grouped and marked, and the floors keep their
  numbering and their names.
- **§3.1 added — the seam inside floor 1.** The identity map serves handover integrity (an
  envelope reads it); the dictionaries and edges beside it are the describer layer a packaging
  implementer never touches. Named explicitly, with the standing instruction not to invent a
  fourth floor number for it.
- **§3.2 documents two optional dictionary facets:** `provenance` on a kind (custody — who
  defined it, under what seal) and `cascade` on a link type (absent means *not declared*). Both
  emit and parse in the reference implementation as of this revision; the canonical key order
  documented here with them is that implementation's, verified against it rather than proposed.
- **§9 records the one-filename-one-definition rule** for a kind that declares a payload shape.
- **§10 added — Extension profiles.** Vendor keys as `x-<vendor>-*` document-root keywords inside
  a record type's JSON Schema, ignorable by any foreign reader; the reference implementation
  registers under `x-noebase-*`. Named as what it is: a vendor extension profile, not core
  semantics. **The key set is deliberately not enumerated here** — a profile grows on its owner's
  clock, so the authoritative list stays with the implementation. §10 also disambiguates the one
  word that spans two subjects: a profile keyword `provenance` inside a schema is a derived-from
  rule at field grain; the kind dictionary's top-level `provenance` is custody.
- **§11 gained two honest gaps** — the format dictionary has no file kind, and no custody
  vocabulary is declared for `provenance` (deliberately, not by oversight), with custody at
  **record-type grain** recorded as an open residue rather than given an invented home.
- **Front matter carries the one-sentence statement of what koine is**, so the specification and
  the repository's outward description cannot drift apart.
- **§12 (was §11) extended** with the profile the package side requires, why a second per-file
  integrity mechanism is redundant, and why a consumer-side relationship cannot live in the
  package.
- **§12 qualified in two places.** **The two digest encodings are not interchangeable today** —
  these sidecars use lowercase hex (`sha256:<hex>`, §3.3), the envelope uses SRI base64
  (`sha256-<base64>`); their jobs are disjoint, so nothing is broken, but choosing one encoding
  for the family is an open decision at the v1 cut, and both specifications change together when
  it is made. And **the irreducible shipping papers are mapped into the envelope's v0 field
  names** — `terms` is the `license` field as it stands, the root hash is still planned
  (`contents[]` carries integrity today), and the envelope's spec-version field is retained
  because its refusal semantics need it. Both were mirrored in the envelope document's §13.
