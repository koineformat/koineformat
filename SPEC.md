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

One file per declared type, `$id`-stamped with `koine/types/<name>@v0`:

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
  `{"id", "path", "format", "contentHash"}`. `id` is stable across renames; `contentHash` is
  `"sha256:" + lowercase-hex sha256 of the file's exact bytes`. No id scheme is prescribed —
  only that an id outlives a path.
- **`edges.jsonl`** — the typed graph slice: `{"from", "to", "type"}` over node ids; `type`
  names an edge type declared in `types/`. An edge a reader can recompute from the bodies (a
  wiki-style link, for instance) is an index rather than truth, and an emitter MAY omit it;
  an **asserted** edge, which no body implies, has nowhere else to live and belongs here.

**The digest spelling is `sha256:<hex>` — everywhere in this standard.** Per-file
checksums over a file tree are eight-year-old, RFC-numbered prior art, and this profile
deliberately sits in that lineage rather than beside it: BagIt (RFC 8493) made SHA-256
manifest rows mandatory vocabulary, and WACZ 1.1.1 carries the same `sha256:<hex>` spelling
in production. The spelling is adopted by citation; SRI base64 (`sha256-<base64>`) is a
browser-subresource dialect and appears in this standard only where the v0 package dialect is
read (§7.11).

### 3.3 The memory — `.koine/history/`

- **`commits.jsonl`** — attributed semantic commits, one per line:
  `{"seq", "actor", "what", "why", "when"}`. `actor` is `actor:(user|agent):<id>`; `when` is
  ISO-8601 **UTC (`Z`)** — no other timezone form is valid.
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

## 4. Validity — the gradient and the travel law

The states are `spoken → draft → valid → frozen`, declared in the shape block's `state`
field. A floor-0 file without a shape block reads as `spoken` — an utterance, not yet a
commitment. Four rules:

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

## 5. Proposals — the day-one gesture

Law 2 makes the proposal the day-one gesture: there is no merge — an incoming version IS a
proposal, and the field-wise conflict list IS the merge. The envelope was extracted from what
the first foreign consumer actually produced, then declared. Normative schema:
[`schemas/proposal.schema.json`](schemas/proposal.schema.json) (`koine/proposal@v0`); worked
example: [`examples/proposals/active-member-60d.proposal.json`](examples/proposals/active-member-60d.proposal.json).

A proposal is a **standalone whole item** (typically sub-kilobyte). Per Law 4 it never
travels *inside* the target tree — it rides any carrier: a PR, an email, a relay, a message.
Its parts:

- **`target`** — node id, path, and `baseContentHash`: the content the proposal was drafted
  against. Staleness is mechanically detectable, never discovered mid-apply.
- **`baseChainHead`** — the history head at drafting time: the receiver can tell whether
  history moved since.
- **`changes`** — the field-wise diff (`field` · `from` · `to`), the proposal's whole intent.
- **`resultingShape`** — the complete shape after the changes, checkable against the declared
  record type in `schema`.
- **`openQuestions`** — what the proposer could NOT decide, surfaced instead of silently
  resolved (a judgment call the shape cannot make for them).
- **`proposer` · `when` · `rationale`** — attribution (attributed, not proven — proving is
  chapter 6).

**Receipt semantics (normative).** A receiver, in order: (1) validate the envelope against
`koine/proposal@v0`; (2) check staleness — `target.baseContentHash` against the current
`nodes.jsonl` entry, `baseChainHead` against the current chain head; a stale proposal is
re-based or returned, never force-applied; (3) validate `resultingShape` against the declared
record type; (4) recompute `diff(currentShape, resultingShape)` — it MUST equal `changes`,
else the proposal is internally inconsistent and rejected; (5) produce the conflict list:
each change is classified **both-intentional** (a human decides) or **one-is-wrong** (the
shape itself convicts — e.g. a rate without a denominator). The conflict list is the output
of receipt, not its cost.

**Acceptance semantics.** On acceptance the holder: edits the body, recomputes the node's
`contentHash`, and appends one commit + one chain link (§3.3). History is append-only —
prior values remain as record, never edited.

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

The byte-exact payload enumeration and its conformance vectors are a declared gap
([Declared gaps](#declared-gaps)): they are extracted from the reference implementation's
test vectors, not authored ahead of them.

### 6.5 Verification — offline, four steps, no registry

A verifier consults nothing but the shipped bytes and public keys: (1) recompute the subject
digest from content; (2) decode the author's public key; (3) verify the signature over the
PAE bytes; (4) for an agent author, verify the **delegation certificate** (§6.7). ~50 lines
in any language.

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
| terms | `license` (+ the reserved `terms` block, §7.5) — one subject, two words: *terms* is the standard's, `license` is the field |
| source | `source` |
| one root hash | `integrity` |
| the signature binding them | `provenance.signature` |

The **`koine` spec-version field is retained and is not one of the six**: refusal semantics
are unimplementable without it — a consumer MUST refuse a manifest whose major version it
does not understand. `description`, `readingFloor`, `representations` and the remaining
`provenance` subfields are **legal accompanying fields** — not irreducible, not thereby
forbidden.

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
- `integrity` — the root hash, §7.4. `koine.json` itself is never covered by it and MUST
  NOT appear in the identity map: the manifest is the envelope, not a body — the seal
  (`provenance.signature`) is what vouches for the manifest.

**What a validator MUST check.** A v0 validator MUST enforce `koine`, `name`, `version` and
`integrity` — including path safety for every payload path it reads (§7.10). The remaining
fields are carried through unvalidated in the reference implementation: a malformed `source`,
`provenance`, `license`, `representations` or `description` is preserved rather than
rejected. A producer therefore cannot rely on a consumer to catch a wrong shape in those
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

### 7.5 Terms — the SPDX atom and the priced half

**The `license` field's value is an [SPDX license expression](https://spdx.org/licenses/)** —
the universal atom (npm, PEP 639, Cargo and the SBOM world all speak it), adopted by
citation. It SHOULD be set; it answers *which license* and nothing else.

**The priced half is reserved.** Knowledge that travels with terms richer than a license —
payment types, permitted and prohibited uses, priced access — needs a vocabulary, and the
field already has one: **RSL** (payment types such as `purchase` · `subscription` ·
`training` · `crawl` · `use`; ISO-4217 amounts; permits/prohibits by usage, user and
geography). What RSL cannot do is address *files inside a package* — its `url` is bound to
an RFC 9309 robots path. **Package-relative addressing is the half-cell this standard
fills:** a reserved top-level `terms` block whose entries address payload members by POSIX
package-relative path or glob pattern, carrying the RSL vocabulary per entry.

The `terms` block is **reserved, not yet normative**: its grammar freezes only after the
pricing-grammar research pass ([Declared gaps](#declared-gaps)), and nothing here is owed by
a v0 implementation beyond carrying the block through verbatim. Until it freezes, `license`
is the terms paper.

### 7.6 What may enter

- **The travel law gates the boundary** (chapter 4, rule 4): a body that declares a state
  below `valid` MUST NOT enter a package; an undeclared body travels as the utterance it is.
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

## Declared gaps

1. **Edge grounding.** How a declared edge relates to (absent) textual anchors in the
   bodies.
2. **Seal payload enumeration + conformance vectors.** Chapter 6's profile fixes the
   contract (DSSE PAE; method and key inside the payload; delegation certificate); the
   byte-exact payload field list and its fixtures are extracted from the reference
   implementation's test vectors, not authored ahead of them.
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
5. **The terms pricing grammar** (§7.5). The `terms` block's exact grammar — the RSL
   vocabulary profiled onto package-relative addressing — freezes after a dedicated legal
   research pass (RSL/ODRL depth), never casually. Until then the block is reserved and
   carried verbatim.
6. **Package-side opens, carried from the envelope's own draft:** versioning semantics
   (§7.9 — the hard one) · registry protocol and multi-registry trust (§7.8) ·
   `representations` (§7.3) · tarball/sourceless distribution and archive signing (§7.8) ·
   whether a package may depend on another package, and how that resolves.

---

## Changelog

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
