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

**Three rules, all learned the hard way.**

1. **A gap whose closing condition is an extraction names the artifact it will extract FROM,
   and checks that it exists.** Declared gap 2 waited a year to be *"extracted from the
   reference implementation's test vectors"* — and that implementation signed a different
   envelope from the chapter, so there was nothing to extract. The gap was waiting on an event
   that could not occur, and three unrelated roads waited behind it.
2. **A finder without a declared population is an opinion.** Each of the three structural
   guards in [`test/guards.test.ts`](test/guards.test.ts) names its population: sections with
   normative language · every `§` any source or test cites · the canonical emission's bytes.
3. **A law with two enforcers is a law with a hole in it.** Seven of the nine defects found by
   outside review lived BETWEEN the pieces, not inside them — the travel law held in
   `emitKoineTree` and not in `sealPackage`, a capability could be named and never refused, a
   verifier checked a mandate only where one already was. Every piece was green. **A new law
   owes a test of the whole path it governs, not only of its own function**, and that is what
   [`test/composition.test.ts`](test/composition.test.ts) is for.

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

### KF-20260917-status-source-is-declared-and-never-fetched
**status:** open · **opened:** 2026-09-17 · **verified:** 2026-09-17
**receipt:** a fixture in which a `withdrawn` status source removes a package from a consumer's
answer context — or a written ruling that fetching is wholly the consumer's and the form says
only *where*
**blocked-on:** []

§7.3 declares where a package's standing is published and what a reader MUST do when it cannot
be reached. **Nothing fetches it**, and the 2026-09-17 review said so plainly: *"Statusabruf,
Freigabelaufzeit und tatsächliche Bereinigung von Such-/Antwortkontext sind nicht ausgeführt."*
The declaration is honest and the mechanism is deliberately outside the format — but *how much*
is outside has never been written down, and a consumer cannot implement a rule whose boundary is
implied.

### KF-20260917-history-has-no-content-revisions
**status:** open · **opened:** 2026-09-17 · **verified:** 2026-09-17
**receipt:** a fixture resolving a historical claim against the body revision it was made about,
from the tree alone
**blocked-on:** [KF-20260917-package-and-schema-migration]

`commit.node` binds a commit to a body (§3.3) and **not to a version of it**: there are no
before/after content hashes and no earlier body files, so a tree cannot answer *what did this
say when that claim was made*. The 2026-09-17 review's verdict is the precise one — *"teilweise
verbessert, nicht geschlossen. Atlas muss unveränderliche Revisionen weiterhin selbst halten."*
Every consumer that needs historical resolution therefore holds its own revision store beside
the form, which is a lossy boundary wearing a workaround.

### KF-20260917-free-text-history-is-unclassifiable
**status:** open · **opened:** 2026-09-17 · **verified:** 2026-09-17
**receipt:** a fixture in which a frozen slice's surviving commits are filterable by SUBJECT, not
only by bound node
**blocked-on:** []

Chapter 4 rule 5 filters history by `commit.node`, and the id-leak scan catches an excluded id
spelled in prose. Neither reaches a commit whose `what`/`why` discusses withheld material without
naming it. *"Freitext ohne Objektbindung/ID bleibt unklassifizierbar"* — so a slice's redaction is
mechanical for what is bound and a judgment call for what is written, and the form does not say
which it guarantees.

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
| **KF-20260917-B1-seal-drops-meaning** | 2026-09-17 — `sealPackage` kept four fields and rebuilt from files, so `state` and `absent` rows died at the package boundary; §7.4 now requires preservation and `test/composition.test.ts` runs `emit → seal → parse → frozen export` whole |
| **KF-20260917-B2-agent-without-mandate** | 2026-09-17 — an `actor:agent:` author with no delegation certificate verified `valid: true`; §6.7 now requires the mandate and `verifySeal` answers `delegation-missing` |
| **KF-20260917-B3-seal-misses-the-papers** | 2026-09-17 — the package subject was `{name, version, integrity}` and the root hash excludes `koine.json`, so licence, source, terms, `requires` and `status` were unsigned. `packageSubject` now binds `papers`, a digest over the manifest less its own signature |
| **KF-20260917-B4-no-composed-contract** | 2026-09-17 — the checks existed and nothing composed them, so a required capability could be *named* and never *refused*. New §7.15 and `admitPackage` |
| **KF-20260917-B5-proposal-target-and-schema** | 2026-09-17 — the declared `schema` id was never read, and acceptance wrote to the drafted path after a rename. Both refused now; the receipt reports the resolved target |
| **KF-20260917-B6-schema-subset-conformance** | 2026-09-17 — a boolean is a schema (three keywords inverted, two failing open), and `const`/`enum` compared serialized key order |
| **KF-20260917-B7-schema-id-substituted** | 2026-09-17 — the emitter accepted a foreign `$id` and the parser stripped it, so a re-emit substituted koine's. §2.1 now says the FILENAME binds and the author's `$id` travels |

---

## The finders

**Nothing here goes looking on its own yet, and that is the honest state.** What exists:

- **the three structural guards** ([`test/guards.test.ts`](test/guards.test.ts)) — text-vs-code
  drift, dangling citations, emission stability. They run in CI on every push.
- **the conformance suite** ([`test/conformance.test.ts`](test/conformance.test.ts)) — UPSTREAM
  tests written here, on the basis of a prospective consumer's five published acceptance
  criteria. Their value is that the criteria are external: they test compositions, which is
  where a green in-house suite was blind.

  **Corrected 2026-09-17, at that consumer's request, and the correction matters more than the
  wording.** This file called them *"the first consumer's own acceptance criteria"* and *"the
  cheapest independent second-implementation pressure there is."* They are neither. They are
  **not a passed acceptance** — no one has accepted anything — and they are **not a second
  independent implementation**: they run in this repository, against this codec, written by its
  editors. Borrowing a reviewer's criteria does not borrow their independence, and a suite that
  claims it is a suite that will be believed past its evidence. The 2026-09-17 review found
  seven further defects while these tests were green, which is the measurement of exactly how
  much they prove. §5.6's claim ratchet applies to this repository's own README and register
  first.
- **the cross-implementation test** ([`test/examples.test.ts`](test/examples.test.ts)) — the
  example tree's sidecars come from a different implementation than the codec that reads them.
- **the review counter-probes** ([`test/review-probes.test.ts`](test/review-probes.test.ts) ·
  [`test/composition.test.ts`](test/composition.test.ts)) — the 2026-09-17 review's own
  reproductions, kept in the reporter's framing and named by their finding ids, so a test that
  closes a finding can still be read against the report that opened it.

**The nearest thing to a second implementation is not ours.** The same review reports an
independent Python reader over a subset of the form, built for its own adapter pilot, resolving
the same revision-bound JSON Pointers and reaching the same content as the published JavaScript
codec. That is external evidence and it is theirs to characterize, not this register's.

What does not exist: a periodic reader. The next conformance contributor is the next adopter,
and asking one for their acceptance criteria is how this file gets its next entries — which is
how the seven findings of 2026-09-17 arrived.
