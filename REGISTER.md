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

**Seven rules, all learned the hard way.**

1. **A gap whose closing condition is an extraction names the artifact it will extract FROM,
   and checks that it exists.** Declared gap 2 waited a year to be *"extracted from the
   reference implementation's test vectors"* — and that implementation signed a different
   envelope from the chapter, so there was nothing to extract. The gap was waiting on an event
   that could not occur, and three unrelated roads waited behind it.
2. **A finder without a declared population is an opinion.** Each of the three structural
   guards in [`test/guards.test.ts`](test/guards.test.ts) names its population: sections with
   normative language · every `§` any source or test cites · the canonical emission's bytes.
3. **A verifier DERIVES what it checks and is TOLD only what it checks against.** Six of the
   twelve findings across three rounds were this one shape: the subject taken from the caller
   (B8), the papers reduced to three fields (B3), the write target taken from the proposal rather
   than resolved (B5), the mandate checked only where one already was (B2), the actor trusted
   without being validated (B10), the id matched without its version (B11). The fix is a TYPE,
   not a docblock — `admitPackage` no longer accepts a subject at all, and an API that cannot
   express the mistake needs no rule against it.
4. **A reported defect is a SHAPE, not a site — run it as a query before closing it.** Two of
   round 4's three findings were introduced BY round 3's repairs, and the third was a rule
   written into the specification and implemented at one step of five. Running round 3's shapes
   as queries (*where else is equality serialized? where else is a rule applied at one site?*)
   found the reported instances **and one the reviewer could not have seen** — a seal's own
   subject comparison, reachable only from a foreign producer, which would have refused a valid
   seal from a second implementation. The query costs minutes; the alternative is another round.

   **Sharpened 2026-09-17, by running it properly for the first time.** The queries had been run
   over *the code the report pointed at*, which is barely a query at all. Run over the whole of
   `src/` before the next release rather than after the next report, the same two questions found
   **three more defects, none of them reported** — a public resolver taking the hash it was meant
   to check from its caller, a second enforcer for the state law introduced by the repair that
   closed the law's first hole, and one grammar written three times at three strictnesses. The
   population of a query is the source, not the citation; and its moment is before a release, not
   after a report.
5. **A law with two enforcers is a law with a hole in it.** Seven of the nine defects found by
   outside review lived BETWEEN the pieces, not inside them — the travel law held in
   `emitKoineTree` and not in `sealPackage`, a capability could be named and never refused, a
   verifier checked a mandate only where one already was. Every piece was green. **A new law
   owes a test of the whole path it governs, not only of its own function**, and that is what
   [`test/composition.test.ts`](test/composition.test.ts) is for.

6. **A rule's population is the set of places the rule NAMES — never the sites you remember.**
   The actor grammar is one rule over four fields and six entry points. The query that found it
   enumerated the three sites it could recall, repaired those, and wrote a test titled *at all
   three grains*. The fifth review round found the fourth field open (`edge.actor`); enumerating
   the fields from the type definitions — `grep` for every declaration the grammar's own docblock
   names — found both EMITTERS open too, which no reader-side probe could have reached. A finder
   without a declared population is an opinion (rule 2), and that applies to a finder you are
   running on your own repair.
7. **A refusal's account is part of the refusal, and the account is what gets read.** Three
   consecutive rounds found defects in what the codec SAID it had done rather than in what it
   decided: the order documented and not implemented (B12), the stop rule at one step (B15), and
   `notRun` naming a check whose result sat in the same object (B15, fifth round). Every one of
   them refused the right artifact. **A report a consumer must cross-check against the result it
   came with is a report that consumer will stop reading** — and then they read the source, which
   is the outcome a specification exists to prevent. Deriving a fact by subtraction is only as
   true as the universe you subtract from: the fourth round's repair derived `notRun` correctly
   from a wrong set.
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

### KF-20260917-absent-body-has-no-resolver
**status:** open · **opened:** 2026-09-17 · **verified:** 2026-09-17
**receipt:** a fixture in which a receiver proves it holds the exact referenced bytes of a
required-absent body, and the package's seal and pin are untouched by the proof
**blocked-on:** []

**Raised by the 2026-09-17 review as the next contract question, and it is the right one.** A
package may declare a body it does not carry, with that body's digest (§3.2). A receiver that
obtains the bytes elsewhere can check them — and has **no way to say so**. `admitPackage` offers
no resolver, so `status: incomplete` is permanent from the package's point of view however
completely the receiver has solved it locally.

**The trap the question already names, and the reason this is a contract and not a feature.**
Adding the body and re-sealing produces a NEW package: a new root hash, a new manifest digest, a
new subject, and the old signature no longer applies. That is correct behaviour and it is not
evidence retrieval — and it **must not silently replace the old pin**, or a consumer's lockfile
would quietly come to mean a different artifact than the one it recorded.

So the shape is a third thing: a *local availability proof* that is checked against the
declaration and stays outside the sealed bytes. Where it lives — a lockfile field, a resolver
handed to `admitPackage`, or wholly the consumer's with only the rule written here — is the open
question. The form owes a declaration; whether it owes the verb is what this entry decides.

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
| **KF-20260917-B5-proposal-target-and-schema** | 2026-09-17 — the declared `schema` id was never read, so a proposal naming a record type that does not exist received `ready`; that is refused now. The rename half is **resolved rather than refused**: an id outlives a path, so the receiver reports `resolved: {nodeId, path, renamed}` and `acceptProposal` REQUIRES that path — the write target is the one the receiver resolved, never the one the proposal was drafted against |
| **KF-20260917-B6-schema-subset-conformance** | 2026-09-17 — a boolean is a schema (three keywords inverted, two failing open), and `const`/`enum` compared serialized key order |
| **KF-20260917-B8-seal-of-a-vouches-for-b** | 2026-09-17 — `admitPackage` took the seal's SUBJECT from its caller and never bound it to the package it had just read, so a genuine signature over package A admitted package B. The subject is derived from the read manifest now; an `expectedSubject` may be compared beside it but never substituted for it |
| **KF-20260917-B9-canonicalization-lost-a-key** | 2026-09-17 — the canonical projection built a `{}`, and assigning `__proto__` sets a prototype rather than an own property, so a legal JSON key vanished before the digest: two different manifests, one digest, a real signature valid across a real change. Canonicalization now serializes directly from sorted pairs — no object model between the data and the bytes |
| **KF-20260917-B10-actor-grammar-unchecked** | 2026-09-17 — a mandate signed by another AGENT was accepted (a chain with no person at the end), an author that was not an actor at all passed every prefix test, and a missing author threw a `TypeError`. Structure is validated before semantics, and each case has a named refusal |
| **KF-20260917-B11-version-suffix-ignored** | 2026-09-17 — `metric@v999` resolved to `metric@v0` because the id was matched on its name and the version discarded. The whole id is compared, and a record type carrying its own `$id` is addressed by it |
| **KF-20260917-B12-order-documented-not-implemented** | 2026-09-17 — `admitPackage`'s docblock said capabilities refuse *before* any semantic check and the code ran them anyway; a malformed sidecar escaped as an uncaught `KoineParseError`. The order is the code's now, skipped steps are NAMED in `notRun`, and a parse failure is a verdict |
| **KF-20260917-B13-expected-identity-ignored** | 2026-09-17 — `expectedSubject` was compared only inside the seal branch, and compared by serialized order. Identity is its own step now, checked without a seal and canonically; the same query found the unreported sibling in `verifySeal`'s own subject comparison |
| **KF-20260917-B14-absence-equalled-null** | 2026-09-17 — the round-3 canonicalization repair made `undefined` render as `"null"`, so a proposal adding a field as `null` read as changing nothing. Equality answers presence before it compares values |
| **KF-20260917-B15-stop-rule-at-one-step** | 2026-09-17 — §7.15's stop-on-refusal was implemented at one step of five, and the single early return overwrote the first refusal. The steps are declared once and `notRun` is derived by subtraction |
| **KF-20260917-B7-schema-id-substituted** | 2026-09-17 — the emitter accepted a foreign `$id` and the parser stripped it, so a re-emit substituted koine's. §2.1 now says the FILENAME binds and the author's `$id` travels |
| **KF-20260917-Q1-locator-trusts-its-caller** | 2026-09-17 — **found here, reported by nobody.** `resolveLocator(locator, body, actualHash)` took the version it resolved against from its caller; handed `locator.contentHash` it answered `resolved` for every pointer forever, and `stale` — the whole yield of the required hash — became unreachable. §3.4 requires derivation; the reusing variant is `resolveLocatorAgainst`, named so the reuse is visible. An API break against 0.8.0, taken deliberately |
| **KF-20260917-Q2-state-law-has-two-enforcers** | 2026-09-17 — **found here.** Closing B1 (*the seal drops the state*) taught `sealPackage` to read the shape block, which `emitKoineTree` already did: the repair for a law with one hole produced a law with two enforcers, and they had already drifted on a body whose declaration contradicts the asserted value. §4 states the resolution once; `travellingState` is the one function both boundaries call |
| **KF-20260917-B15r-notrun-named-a-computed-check** | 2026-09-17 — the fifth round. A package carrying BOTH a schema-invalid body and a dangling edge reported `notRun: ["references", …]` in the same object that carried `references: fail` with the missing target named. `ran` was appended where each BRANCH was reached, while two computations produce five of the answers — so the fourth round's subtraction was correct over a wrong set. `ran` records where the ANSWER was computed; §7.15 states that schema and references are two verdicts of ONE computation and that `notRun` means *no answer in this result*, never *the flow did not reach this branch* |
| **KF-20260917-B16-the-edge-actor-escaped-the-grammar** | 2026-09-17 — the fifth round found `edge.actor: "bob"` and `"actor:user:"` crossing parser, tree verify and admission untouched: the Q3 repair reached three of four fields because its population was the sites its author remembered. Enumerating the fields from the type definitions found **both emitters open as well** — `emitCommitsJsonl` would write an actor `parseCommitsJsonl` refuses, so the codec could emit a tree it could not read. One predicate, four fields, six entry points, reader AND writer. §3.3 now carries the emitter half; rule 6 above is this finding |
| **KF-20260917-Q4-a-parse-failure-wore-integritys-name** | 2026-09-17 — **found here**, by running B15's shape (*does the account match what was done?*) against `verifyKoineTree` instead of `admitPackage`. Its docblock said no question could be asked of an unparseable tree and the code answered `integrity: fail` anyway. The verdict is right and §3.5's wording was narrower than the design: integrity asks whether the record is intact AND readable. §3.5 says so now, and the problem text names which half failed — a syntax error and a byte mismatch have two remedies and one bucket |
| **KF-20260917-Q3-actor-grammar-three-times** | 2026-09-17 — **found here.** §3.3's grammar was implemented at three strictnesses: non-empty id in the seal, prefix-only in the proposal receiver, unchecked in `commits.jsonl`. Measured — `actor:user:` was a valid proposer and an invalid seal author, `bob` was a valid commit actor and invalid everywhere else. One `isKoineActor`, used at all three grains. **Corrected by B16:** the form has FOUR actor fields and this repair reached three, at the reader only — see the two rows above |

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

**A real consumer has now read koine end to end, and it is not ours.** On 2026-09-17 the
reviewing project took one synthetic knowledge slice through JSON and through koine into two
isolated PostgreSQL/pgvector databases and ran its **unchanged** chunker, search service and
retrieval node: *both paths return the same hits, the same sources and the same statement
revisions.* A revision replaces the old chunks; a withdrawal leaves **zero hits in the direct
module search and zero chunks for that source** — their pipeline's own fallback, which searches
without the module filter, still reaches an unrelated sentinel source, and zero hits across the
whole pipeline is NOT what was shown; an internal statement never reaches the released index; a
corrupted package leaves the prior state intact and a mid-import SQL failure rolls back whole.
Forty-four conditions, plus fourteen counter-probes of their package guard. Their own follow-up
work — a version filter carried through the retrieval node, structured metadata in the hit
object, and hard rights limits that a fallback must not bypass — stays theirs and is open.

**That paragraph is corrected 2026-09-17 at the consumer's request, and it is the third time
this register has overstated their evidence in their direction.** The first two were a claimed
acceptance and a claimed second implementation. Each time the overstatement was small, flattering
to us, and about work we did not do. §5.6's claim ratchet is a rule about outward claims; a
register that summarises somebody else's measurement is making one.

That is the strongest external evidence this form has, and it is **theirs to characterize, not
this register's**: it is a limited integration test on synthetic data with fixed test vectors, not
a production acceptance, and they say so. What it settles is narrower and real — the form carries
enough for a working consumer to behave identically to the one it already had.

**The nearest thing to a second implementation is not ours.** The same review reports an
independent Python reader over a subset of the form, built for its own adapter pilot, resolving
the same revision-bound JSON Pointers and reaching the same content as the published JavaScript
codec. That is external evidence and it is theirs to characterize, not this register's.

**The query pass — the first finder this repository runs on itself.** Population: the whole of
`src/`. Questions: *where is something checked against a value its own caller supplied* (rule 3)
and *where does one rule have more than one enforcer* (rule 5) — the two shapes fifteen findings
reduced to. Run once, on 2026-09-17, before the 0.9.0 release and after the fourth review round:
**three defects, none reported, two of them introduced by our own repairs** (Q1 · Q2 · Q3 above).

It is characterized honestly or it is worth nothing: it is **manual**, it is **not periodic**, it
is run by the same editors who wrote the code, and every one of its questions came from somebody
else's finding. It does not replace a reader. What it changes is the ratio — a review round cost
its reviewer hours and returned findings whose repairs cost us minutes, and the queries those
findings taught can be run against the whole source for a fraction of a round. **A standard whose
defects are all found by its readers has outsourced its verification to people who owe it
nothing.** The next round's job should be checking our work, not replacing it.

What still does not exist: a periodic reader, and an independent one. The next conformance
contributor is the next adopter, and asking one for their acceptance criteria is how this file
gets its next entries — which is how the seven findings of 2026-09-17 arrived.
