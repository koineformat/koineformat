#!/usr/bin/env python3
"""Reference verifier for a koine repo — floors 1 and 2, no dependencies.

Usage: python3 verify.py <path-to-koine-repo>

Checks every contentHash in .koine/nodes.jsonl against the working tree, and
recomputes the full .koine/history/ Merkle chain per the normative algorithm
(SPEC.md section 3.3). Exit 0 = PASS, 1 = FAIL. This is the whole point of the
format: verification needs no server, no account, no tooling beyond this.
"""
import hashlib
import json
import sys
from pathlib import Path

def main() -> int:
    repo = Path(sys.argv[1])
    ok = True

    for line in (repo / ".koine/nodes.jsonl").read_text().splitlines():
        node = json.loads(line)
        actual = "sha256:" + hashlib.sha256((repo / node["path"]).read_bytes()).hexdigest()
        if actual != node["contentHash"]:
            print(f"FAIL node {node['id']} ({node['path']}): {actual} != {node['contentHash']}")
            ok = False
        else:
            print(f"ok   node {node['id']} ({node['path']})")

    commits = (repo / ".koine/history/commits.jsonl").read_text().splitlines()
    chain = [json.loads(l) for l in (repo / ".koine/history/chain.jsonl").read_text().splitlines()]
    header, links = chain[0], chain[1:]
    if len(links) != len(commits):
        print(f"FAIL chain: {len(links)} links for {len(commits)} commits")
        ok = False
    prev = "0" * 64
    for line, link in zip(commits, links):
        commit = hashlib.sha256(line.encode()).hexdigest()
        expected = hashlib.sha256((prev + commit).encode()).hexdigest()
        if commit != link["commit"] or prev != link["prev"] or expected != link["hash"]:
            print(f"FAIL chain seq {link['seq']}: recomputed {expected} != recorded {link['hash']}")
            ok = False
        else:
            print(f"ok   chain seq {link['seq']} {link['hash'][:12]}…")
        prev = link["hash"]

    print("PASS" if ok else "TAMPERED-OR-BROKEN", f"({header['format']})")
    return 0 if ok else 1

if __name__ == "__main__":
    sys.exit(main())
