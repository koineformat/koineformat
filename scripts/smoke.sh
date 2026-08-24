#!/usr/bin/env bash
# End-to-end smoke test: vendor the in-repo examples package into a clean,
# throwaway consumer repo and verify it. Hermetic and offline (path: source),
# so CI proves the whole add → verify chain without network or a circular
# dependency on this repo being pushed. Requires `bun run build` first.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN="$ROOT/dist/koine.js"
[ -f "$BIN" ] || { echo "dist/koine.js missing — run 'bun run build' first" >&2; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cd "$TMP"

# Exit codes are an interface: a tool that exits non-zero when you ask it for
# help breaks `koine --help && …` and every wrapper script built on it.
check_exit() {
  local expected="$1" label="$2"; shift 2
  local rc=0
  "$@" >/dev/null 2>&1 || rc=$?
  [ "$rc" = "$expected" ] || { echo "✗ $label: expected exit $expected, got $rc" >&2; exit 1; }
}
# Exit 0 alone would also be satisfied by printing nothing, so every "asked for
# help" form asserts the usage actually reaches stdout. Command substitution
# captures stdout only, so this also proves it is not on stderr.
check_usage() {
  local label="$1"; shift
  case "$("$@")" in
    *"Consumer:"*"Publisher:"*) ;;
    *) echo "✗ $label: usage text missing from stdout" >&2; exit 1 ;;
  esac
}
echo "→ exit codes"
check_exit 0 "koine --help"    node "$BIN" --help
check_exit 0 "koine -h"        node "$BIN" -h
check_exit 0 "koine help"      node "$BIN" help
check_exit 0 "koine help add"  node "$BIN" help add   # extra words ignored, not an error
check_exit 0 "koine --version" node "$BIN" --version
check_exit 1 "koine (no args)" node "$BIN"
check_exit 1 "koine bogus"     node "$BIN" bogus-command

check_usage "koine --help"   node "$BIN" --help
check_usage "koine help"     node "$BIN" help
check_usage "koine help add" node "$BIN" help add

echo "→ koine add path:<in-repo examples/team-decisions> (from a clean repo)"
node "$BIN" add "path:$ROOT/examples/team-decisions"

echo "→ koine verify"
node "$BIN" verify

echo "→ koine list"
node "$BIN" list

test -f knowledge/team-decisions/pin.json
test -f knowledge/.pin-lock.json
grep -q "Friday" knowledge/team-decisions/conventions.md

echo "✓ smoke OK — vendored + verified a real package from a clean repo"
