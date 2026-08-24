# Decisions

Architectural decision records. Newest first. Each entry is a claim the team has
committed to; the graph in [`graph.json`](./graph.json) records how they depend on
one another.

## ADR-3 — Vendored, not remote

**Decision:** Knowledge an agent needs is vendored into the repo as plain files,
not fetched from a remote service at call time.

**Why:** A vendored package is local, native, diffable, and reviewable as a PR. An
agent cross-references it against the real code in one `grep` — offline.

## ADR-2 — A thin envelope, free content

**Decision:** Standardize only identity, versioning, provenance, and integrity.
Never dictate how the knowledge itself is written.

**Why:** Knowledge is irreducibly multi-representational (prose, graph, table).
There is no single diffable substrate that fits all of it, so we wrap, not convert.

## ADR-1 — No code execution, ever

**Decision:** Installing a knowledge package runs nothing — no postinstall, no
hooks. A package is inert bytes until an agent reads it.

**Why:** It is the deliberate anti-npm guarantee. The install step cannot be a
supply-chain attack because there is no install step that executes.
