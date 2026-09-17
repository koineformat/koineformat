# The register

**Every open delta in this standard stands here as ONE entry, and nowhere else.**

A specification's failure mode is not a bug. It is **drift between the text and the code**,
and drift is never found by the people who wrote both. This repository's first finder was a
stranger: on 2026-09-16 an unaffiliated project assessed koine for a real pilot, probed the
public codec, and reported defects that had been in the source for months — under a green
test suite, beside a specification that declared each of them normative.

Until that day the only record of what was open was the SPEC's hand-written *Declared gaps*
list: no dates, no status, no owner, no receipt, and no way to tell a gap that was being
worked from one that had been forgotten. This file replaces it as the working record. The
SPEC's list stays as the **numbered, citable** form — a number in a published document must
keep resolving — and points here.

## The entry contract

| field | meaning |
|---|---|
| **id** | `KF-<YYYYMMDD>-<slug>`, unique and permanent |
| **status** | `open` · `parked` (waiting on a named trigger) · `closed` |
| **opened** / **closed** | dates, never "recently" |
| **receipt** | what makes it closable — a named test, a fixture, a vector. An entry with no receipt is a wish |
| **blocked-on** | entry ids, or `trigger:"<falsifiable event>"` |
| **verified** | the last date the claim was checked **against the code**, not against this file |

**Two rules, both learned the hard way.**

1. **A gap whose closing condition is an extraction names the artifact it will extract FROM,
   and checks that it exists.** Declared gap 2 waited a year to be *"extracted from the
   reference implementation's test vectors"* — and that implementation signed a different
   envelope from the chapter, so there was nothing to extract. The gap was waiting on an event
   that could not occur, and three unrelated roads waited behind it.
2. **A finder without a declared population is an opinion.** Each of the three structural
   guards in [`test/guards.test.ts`](test/guards.test.ts) names its population: sections with
   normative language · every `§` any source or test cites · the canonical emission's bytes.

---

## Open

### KF-20260917-statement-level-normative-ids
**status:** open · **opened:** 2026-09-17 · **verified:** 2026-09-17
**receipt:** `test/guards.test.ts` — guard 1 binds at STATEMENT grain instead of section grain
**blocked-on:** []

Guard 1 requires every section containing `MUST`/`SHALL` to be cited by some test. That fires
when a new normative section lands untested, which is the drift that actually happens — and it
cannot tell a section with one tested MUST from a section with six, one of which is tested.
The stronger form is a stable id per normative statement (`[KF-S-7.3-04]`), cited by the test
that proves it. It is a retrofit across ~1200 lines and it is worth doing before the document
grows again, not after.

### KF-20260917-package-and-schema-migration
**status:** open · **opened:** 2026-09-17 · **verified:** 2026-09-17
**receipt:** a fixture in which a record type changes shape and existing bodies are carried,
migrated or refused — each outcome named by the form rather than by a consumer's guess
**blocked-on:** []

Raised as P1 by the 2026-09-16 assessment: *"required capabilities, schema/package migration
and lossless unknown fields; an explicit contract for restricted readers."* §8.1 answered the
first and the third. **Migration is untouched**: a record type may change between two versions
of a package, and nothing in the form says what happens to bodies written against the old one.
Every answer is currently a consumer's private decision, which is the definition of a lossy
boundary.

### KF-20260917-format-dictionary
**status:** open · **opened:** 2026-08-07 (as SPEC declared gap 3) · **verified:** 2026-09-17
**receipt:** a `types/<name>.formattype.json` with a round-trip fixture, or a written decision
that the fourth dictionary stays a field
**blocked-on:** []

The fourth dictionary has no sidecar file kind; a body's format travels as a field of its
identity-map row (§3.2). What a format declaration would *consist of* is open. Carried from
the SPEC's numbered list, where it stays as gap 3.

### KF-20260917-custody-vocabulary
**status:** open · **opened:** 2026-08-07 (as SPEC declared gap 4) · **verified:** 2026-09-17
**receipt:** a declared vocabulary with fixtures, or a written decision that custody stays
carried-verbatim
**blocked-on:** [KF-20260917-record-type-custody-grain]

`provenance` (§2.1) is carried verbatim and this document deliberately declares no vocabulary
for who-defined-this and under-what-seal. **Now that chapter 6 has shipped its fixtures, the
reason for waiting is gone** — the gap's own text said inventing a custody schema *"ahead of
the seal fixtures (gap 2)"* would fix the wrong shape early, and gap 2 closed 2026-09-17.

### KF-20260917-record-type-custody-grain
**status:** open · **opened:** 2026-08-07 (as the second half of SPEC declared gap 4) · **verified:** 2026-09-17
**receipt:** a record type carrying custody through emit → parse → emit, or a written decision
that it never does
**blocked-on:** []

A Kind carries its custody; **a record type has nowhere to put one**, and no home was invented
for it. Split out from the custody vocabulary because the two have different answers: one is
*which words*, this one is *which file*.

### KF-20260917-package-side-opens
**status:** open · **opened:** 2026-08-07 (as SPEC declared gap 6) · **verified:** 2026-09-17
**receipt:** per sub-item; this entry closes only when each has its own entry or its own answer
**blocked-on:** []

Six carried from the envelope's own draft, and they are **six questions in one row**, which is
why none of them has moved: versioning semantics (§7.9 — the hard one) · registry protocol and
multi-registry trust (§7.8) · `representations` (§7.3) · tarball/sourceless distribution and
archive signing (§7.8) · whether a package may depend on another package, and how that
resolves. Splitting them is this entry's first act.

### KF-20260917-selector-degradation-per-format
**status:** open · **opened:** 2026-09-17 · **verified:** 2026-09-17
**receipt:** a row in §3.4's table per format a producer actually round-trips
**blocked-on:** [trigger:"a producer round-trips a format §3.4 has not measured"]

§3.4's six selectors were measured against the formats knowledge travels in today — text,
source, PDF, media, structured rows. **How each degrades for a format nobody has round-tripped
is not assumed here and is not answered either.** A new row is written when a producer earns
it, never on speculation.

---

## Closed

| id | what closed it |
|---|---|
| **KF-20260916-roundtrip** *(SPEC declared gap 1, edge grounding)* | 2026-09-17 — §3.2's `state`, §3.3's `node`, chapter 4 rules 4–5, §3.5's four verdicts, and §3.4 the Locator. `test/crossing.test.ts` |
| **KF-20260916-must-understand** | 2026-09-17 — §8.1 required capabilities, at both grains. `test/verdict.test.ts` |
| **KF-20260916-package-honesty** | 2026-09-17 — §3.2's `absent`, §7.3's `status`. `test/verdict.test.ts` |
| **KF-20260916-receiver** | 2026-09-17 — chapter 5's five steps, both grains, two worked examples. `test/proposal.test.ts` · `test/examples.test.ts` |
| **KF-20260827-terms-grammar** *(SPEC declared gap 5)* | 2026-08-27 — §7.5 froze; its carry-verbatim rule got its first test 2026-09-17 |
| **KF-20260916-seal** *(SPEC declared gap 2)* | 2026-09-17 — §6.4's payload enumeration, §6.7's certificate, `test/vectors/seal-v0.json`. See rule 1 above for why the original plan could not have worked |
| **KF-20260916-outward-claims** | 2026-09-17 — the README said *"not yet published"* while npm served `0.1.2` for three weeks. Now checked by `test/guards.test.ts` |

---

## The finders

**Nothing here goes looking on its own yet, and that is the honest state.** What exists:

- **the three structural guards** ([`test/guards.test.ts`](test/guards.test.ts)) — text-vs-code
  drift, dangling citations, emission stability. They run in CI on every push.
- **the conformance suite** ([`test/conformance.test.ts`](test/conformance.test.ts)) — the
  first consumer's own five acceptance criteria, as compositions. Written by the party that has
  to USE the form, which is the cheapest independent second-implementation pressure there is,
  and the reason they found what a green in-house suite did not: **they test compositions, and
  the in-house suite tested each law alone.**
- **the cross-implementation test** ([`test/examples.test.ts`](test/examples.test.ts)) — the
  example tree's sidecars come from a different implementation than the codec that reads them.

What does not exist: a periodic reader. The next conformance contributor is the next adopter,
and asking one for their acceptance criteria is how this file gets its next entries.
