# Contributing to the Koine Format

The Koine Format is an open standard under a simple rule: **proposals are pull requests; the maintainer decides; every accepted change lands as a versioned SPEC revision.**

- **Questions and ideas** → open an issue. Small and concrete beats broad and abstract.
- **Spec changes** → open a PR against `SPEC.md`. Say what breaks without the change and what it costs. Accepted changes are noted in the SPEC's revision history.
- **The bar:** the format stays small (an envelope everyone can afford), self-describing (a stranger's agent can consume it cold), and safe by construction (a package can never execute anything at install time).
- **Code** (`koine`, validator, fixtures) → PRs welcome. The `koine` CLI in this repo is an early **v0 reference implementation** that tracks the RFC; every invariant carries a test.

No CLA, no committees, no process theater — Apache-2.0, one maintainer, versioned revisions. If the project ever needs more governance than this page, that will itself be a versioned, public decision.
