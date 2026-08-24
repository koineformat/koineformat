# Koine Repo

A **koine repo** is a body of knowledge as a cloneable form: a tree of ordinary
LLM-readable files plus `.koine/` sidecars carrying identity, grammar and memory.
It is the git of the meaning-shaped asset class — built for meaning's
peculiarities (no branches, shape-merge, a validity gradient, attribution) the
way git was built for code's.

## The three floors

Each floor is fully worth consuming without the ones above it.

- **floor 0 · the tree** — any LLM-readable files, named and arranged. A bare
  floor-0 tree is already koine.
- **floor 1 · the grammar** — `.koine/` sidecars: the identity map
  (`nodes.jsonl`), the typed graph slice (`edges.jsonl`), and the type
  dictionaries (`types/*.schema.json` · `*.tagtype.json` · `*.edgetype.json`).
- **floor 2 · the memory** — history that travels: attributed semantic commits
  (`history/commits.jsonl`) and a tamper-evident, holder-custodied Merkle chain
  (`history/chain.jsonl`). Every holder carries the full history; the origin
  cannot rewrite it.

## The five laws

1. **Sidecar, never frontmatter** — bodies stay verbatim; the files are yours,
   unmodified.
2. **No merge, no branches, ever** — an incoming version is a proposal; the
   field-wise conflict list IS the merge.
3. **Executable members inert** — source and manifest travel; execution is
   platform-bound.
4. **Exclusions absolute** — membership, permissions, presence, secrets,
   pending proposals and live threads never travel.
5. **Every floor stands alone** — enters simple, grows up.
