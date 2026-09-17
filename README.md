# Koine Format

**Koine (Koine Format) is an open standard for the meaning layer of knowledge — definitions,
types and history as ordinary files.** A body of knowledge as a cloneable form: LLM-readable
files plus `.koine/` sidecars carrying identity, grammar and memory. The substrate is
declarable — the types a repo travels with are its own — and what arrives is one frozen form
at every door: bodies verbatim, no code execution, no live sync, nothing to run to read it.

*Koine* /kɔɪˈneɪ/ — named after **koinē Greek**: never mandated, it emerged as a shared *form*
that let sovereign communities speak without giving up their own words. That is the design in
one word: koine standardizes the **shape** of meaning, never anyone's vocabulary.

## The three floors

Each floor is fully worth consuming without the ones above it — a bare file tree is already koine.

| Floor | What travels | Where |
|---|---|---|
| **0 · the tree** | any LLM-readable files, named and arranged | the repo itself |
| **1 · the grammar** | the identity map, the typed graph slice, the type dictionaries | `.koine/nodes.jsonl` · `edges.jsonl` · `types/` |
| **2 · the memory** | attributed semantic commits + a tamper-evident Merkle chain | `.koine/history/` |

## What no borrowed carrier gives you

**A history nobody can take from you.** Every holder of a koine repo carries the full history;
the origin cannot rewrite it without breaking a chain any second holder's copy exposes.
Verification needs no server, no account, no tooling — a few lines of any language recompute the
chain (see the algorithm in [SPEC.md](SPEC.md)).

**What that does and does not claim.** The chain proves ORDER and INTEGRITY of the commits a tree
carries; it does not prove authorship (chapter 6 does), and it does not carry the content each
commit was about — `commit.node` binds a commit to a body, not to a version of it, so *what did
this say when that claim was made* is a question the form cannot yet answer. That is an open
entry in the [register](REGISTER.md), not a footnote.

## How it travels

Koine v0 is **files**, so whatever already moves files moves koine: a version-controlled
repository, an archive, a bucket, an attachment. Sync, transport, hosting and the
propose-and-review gesture are all somebody else's solved problem, familiar from how code
travels. Where a line-oriented carrier structurally cannot follow — merging meaning field-wise
rather than line-wise, living collaborative rooms, verdict lanes — the form is already shaped
to grow into it.

## Example

[`examples/own-docs/`](examples/own-docs/) is a complete, real koine repo (floors 0–2): two
definitions, a data set, three type dictionaries, a real identity map and a real Merkle chain —
small enough to read in five minutes, complete enough to verify by hand. Verify it:

```
python3 tools/verify.py examples/own-docs
```

[`examples/proposals/active-member-60d.proposal.json`](examples/proposals/active-member-60d.proposal.json)
is a worked proposal against it — the day-one gesture as a standalone whole item
([`schemas/proposal.schema.json`](schemas/proposal.schema.json), SPEC §5).

## The library

`koineformat` is the reference codec: one pair, `emitKoineTree` / `parseKoineTree`, plus
`verifyKoineTree` — the TypeScript sibling of `tools/verify.py` above.

```
npm install koineformat
```

```ts
import { emitKoineTree, parseKoineTree, verifyKoineTree, readDictionaries } from 'koineformat'

// Bodies plus declared identity in; the complete koine file map out.
const files = await emitKoineTree({
  nodes: [{ id: 'n-1', path: 'definitions/active-member.md', format: 'text', bytes, state: 'valid' }],
  edges: [{ from: 'n-1', to: 'n-2', type: 'references' }],
  commits: [{ seq: 1, actor: 'actor:user:ada', what: 'found the room', why: 'first draft', when: '2026-01-01T00:00:00Z' }],
  types: { tags: [...], edges: [...], records: [...] },
})

// Its inverse, and the verdict — every content hash and the whole chain recomputed.
const tree = parseKoineTree(files)
const { ok, problems } = await verifyKoineTree(files)
```

`emitKoineTree` also takes `{ frozenSlice: true }`, which applies the travel law of SPEC §4:
only `valid` and `frozen` nodes enter, and edges are filtered to surviving endpoints.

`parseKoineTree` hands back the type dictionaries already typed, under `tree.dictionaries`, beside
the verbatim `tree.types` map that a byte-identical re-emit needs. `readDictionaries` is the same
step on its own, for a reader holding a bare `types/*` map without a whole tree around it — a
connector manifest, a partial import.

**No dependencies, and no filesystem.** You hand in and receive `Map<relativePath, bytes>`, the
shape a directory walk produces. The one host capability needed is WebCrypto
(`globalThis.crypto.subtle`) — Node 18+, Bun, Deno, browsers and Cloudflare Workers all have it —
which is why hashing is async throughout.

**The vendor eats its own form.** NoeBase's machine imports this exact package at every boundary
where knowledge leaves or enters it. There is no second, internal codec, so the standard and the
product cannot drift apart **in the sense that matters for a consumer**: they are one build, and
a defect in the form is a defect in the product the same day.

It does not mean the implementation is ahead of its own specification. Three rounds of outside
review in two days found twelve defects between what this document declares and what the code
did, every one reproduced against a published release — which is why the
[register](REGISTER.md) is the honest surface for *what is open* and this page is not.

## Status

**v0 DRAFT, published.** The package is on npm and the spec is being extracted from a working
implementation, rather than invented ahead of one. Draft means the chapters still move; it has
never meant the artifact is unreachable — and for three weeks this page said the opposite of
what the registry served, which a stranger found in an hour and nothing here was looking for.
The claim is now checked by this repository's own suite (`test/guards.test.ts`).

---

*Created by NoeBase — knowledge that outlives its author.*
