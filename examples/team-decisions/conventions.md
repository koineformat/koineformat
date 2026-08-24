# Conventions

How this team works, written down so an agent can cross-reference it against the
actual code in a single `grep`.

## Shipping

- **Never deploy on Friday.** See incident #44 — a Friday-evening deploy with no
  one around to watch it cost us a weekend.
- Every architectural decision gets an ADR in [`decisions.md`](./decisions.md).
- A change that alters a public contract updates the SPEC in the **same** PR.
  Code and spec never drift.

## Reviewing

- Treat a freshly vendored knowledge package as untrusted input — review its diff
  like any dependency PR. Integrity hashes prove *what* you got, not that it is *safe*.
- Prefer the smallest change that is honest. "Cleaner code" is not a reason to add
  a synchronization barrier the work does not need.

## Naming

- One intent per action; name it for the intent, not the mechanism.
- Errors name a cause **and** a fix. No stack traces at users.
