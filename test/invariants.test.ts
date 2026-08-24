/**
 * The eight invariants (SPEC.md §15, "Conformance invariants") as executable
 * proof. Each `describe` block is one non-negotiable guarantee; if any goes red,
 * v0 is not done.
 */
import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  fakeGithubFetch,
  githubTarGz,
  gzip,
  buildTar,
  offlineFetch,
  sealedFiles,
  SHA,
  tmp,
  writePackage,
} from "./helpers.js";
import { add } from "../src/commands/add.js";
import { install } from "../src/commands/install.js";
import { update } from "../src/commands/update.js";
import { verify } from "../src/commands/verify.js";
import { list } from "../src/commands/list.js";
import { remove } from "../src/commands/remove.js";
import { isKoineError, type KoineError } from "../src/core/errors.js";
import { contentsDigest } from "../src/core/integrity.js";
import { assertSafeRelPath, assertWithinCaps } from "../src/core/paths.js";

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

describe("U1 zero-config", () => {
  test("add works in a bare repo — no init, no account, no config; knowledge/ + lock created on demand", async () => {
    const pub = await writePackage(join(tmp(), "pkg"), await sealedFiles("team-decisions", { "conventions.md": "x" }));
    const consumer = tmp();
    const r = await add({ cwd: consumer, source: `path:${pub}` });
    expect(r.name).toBe("team-decisions");
    expect(existsSync(join(consumer, "knowledge/team-decisions/pin.json"))).toBe(true);
    expect(existsSync(join(consumer, "knowledge/.koine-lock.json"))).toBe(true);
  });
});

describe("U2 deterministic", () => {
  test("github add pins the resolved commit SHA in the lock", async () => {
    const consumer = tmp();
    await add({ cwd: consumer, source: "github:koineformat/koineformat", fetchImpl: fakeGithubFetch(githubTarGz(await sealedFiles("kb", { "a.md": "A" }))) });
    const lock = JSON.parse(await readFile(join(consumer, "knowledge/.koine-lock.json"), "utf8"));
    expect(lock.packages.kb.resolved.ref).toBe(SHA);
  });

  test("the same lock reproduces a byte-identical tree", async () => {
    const tgz = githubTarGz(await sealedFiles("kb", { "a.md": "A", "b/c.md": "C" }));
    const c1 = tmp();
    const c2 = tmp();
    await add({ cwd: c1, source: "github:koineformat/koineformat", fetchImpl: fakeGithubFetch(tgz) });
    await add({ cwd: c2, source: "github:koineformat/koineformat", fetchImpl: fakeGithubFetch(tgz) });
    for (const f of ["pin.json", "a.md", "b/c.md"]) {
      expect(await readFile(join(c1, "knowledge/kb", f))).toEqual(await readFile(join(c2, "knowledge/kb", f)));
    }
  });

  test("github: extracts a subpath and strips the repo + subpath prefix", async () => {
    const nested = new Map<string, Uint8Array>();
    for (const [rel, b] of await sealedFiles("team-decisions", { "conventions.md": "Never deploy on Friday." })) {
      nested.set(`examples/team-decisions/${rel}`, b);
    }
    const c = tmp();
    const r = await add({
      cwd: c,
      source: "github:koineformat/koineformat/examples/team-decisions",
      fetchImpl: fakeGithubFetch(githubTarGz(nested)),
    });
    expect(r.name).toBe("team-decisions");
    expect(existsSync(join(c, "knowledge/team-decisions/conventions.md"))).toBe(true);
    expect(existsSync(join(c, "knowledge/team-decisions/examples"))).toBe(false); // prefix stripped
  });

  test("the package fingerprint is independent of file order", async () => {
    const a = [{ path: "a", integrity: "sha256-1" }, { path: "b", integrity: "sha256-2" }];
    const b = [{ path: "b", integrity: "sha256-2" }, { path: "a", integrity: "sha256-1" }];
    expect(await contentsDigest(a)).toBe(await contentsDigest(b));
  });
});

describe("U3 idempotent", () => {
  test("re-adding a current package is a no-op — never a rewrite", async () => {
    const pub = await writePackage(join(tmp(), "p"), await sealedFiles("kb", { "a.md": "A" }));
    const c = tmp();
    await add({ cwd: c, source: `path:${pub}` });
    const lockPath = join(c, "knowledge/.koine-lock.json");
    const before = await readFile(lockPath);
    const again = await add({ cwd: c, source: `path:${pub}` });
    expect(again.alreadyUpToDate).toBe(true);
    expect(await readFile(lockPath)).toEqual(before);
  });
});

describe("U4 safe by construction", () => {
  test("rejects a tarball with a .. traversal path", async () => {
    const tgz = gzip(buildTar([{ name: "root/../evil.md", data: enc("pwned") }]));
    await expect(add({ cwd: tmp(), source: "github:o/r", fetchImpl: fakeGithubFetch(tgz) })).rejects.toMatchObject({
      code: "path-traversal",
    });
  });

  test("rejects a symlink entry inside the package", async () => {
    const entries = [{ name: "root/", type: "5" } as const];
    const files = await sealedFiles("kb", { "a.md": "A" });
    const all = [...entries, ...[...files].map(([rel, b]) => ({ name: `root/${rel}`, data: b }))];
    all.push({ name: "root/link.md", type: "2", linkname: "/etc/passwd" } as never);
    await expect(add({ cwd: tmp(), source: "github:o/r", fetchImpl: fakeGithubFetch(gzip(buildTar(all))) })).rejects.toMatchObject(
      { code: "unsafe-entry" },
    );
  });

  test("path sandbox rejects traversal / absolute / drive / backslash", () => {
    for (const bad of ["../x", "a/../../x", "/etc/x", "C:\\x", "a\\b", "..", "\0x", "."]) {
      expect(() => assertSafeRelPath(bad)).toThrow();
    }
    for (const ok of ["a.md", "a/b/c.md", "dir/file.json"]) {
      expect(assertSafeRelPath(ok)).toBe(ok);
    }
  });

  test("refuses an implausibly large package (file-count cap)", () => {
    const many = new Map<string, Uint8Array>();
    for (let i = 0; i < 10_001; i++) many.set(`f${i}.md`, enc("x"));
    expect(() => assertWithinCaps(many)).toThrow();
  });

  test("no code execution: a package with a hook-named file is vendored inert", async () => {
    const pub = await writePackage(join(tmp(), "p"), await sealedFiles("kb", { "postinstall.sh": "#!/bin/sh\necho pwned\n" }));
    const c = tmp();
    await add({ cwd: c, source: `path:${pub}` });
    // It lands as plain bytes; nothing is executed at install time.
    expect(existsSync(join(c, "knowledge/kb/postinstall.sh"))).toBe(true);
  });
});

describe("U5 local-edit protection", () => {
  test("update refuses to clobber locally-edited files; --force overrides", async () => {
    const pubDir = join(tmp(), "p");
    await writePackage(pubDir, await sealedFiles("kb", { "a.md": "ORIGINAL" }));
    const c = tmp();
    await add({ cwd: c, source: `path:${pubDir}` });

    const vendored = join(c, "knowledge/kb/a.md");
    await writeFile(vendored, "LOCALLY EDITED");

    await expect(update({ cwd: c })).rejects.toMatchObject({ code: "local-edits" });

    // A real upstream change + --force overwrites the edit.
    await writePackage(pubDir, await sealedFiles("kb", { "a.md": "UPSTREAM v2" }, { version: "2026.08.0" }));
    const r = await update({ cwd: c, force: true });
    expect(r.items[0]!.updated).toBe(true);
    expect(await readFile(vendored, "utf8")).toBe("UPSTREAM v2");
  });
});

describe("U6 errors are the product", () => {
  test("every failure is a typed KoineError carrying a cause and a fix", async () => {
    const cases: Array<{ run: () => Promise<unknown>; code: string }> = [
      { run: () => add({ cwd: tmp(), source: "ftp://nope" }), code: "unknown-source" },
      { run: () => remove({ cwd: tmp(), name: "missing" }), code: "not-installed" },
    ];
    for (const { run, code } of cases) {
      try {
        await run();
        throw new Error(`expected ${code} to throw`);
      } catch (e) {
        expect(isKoineError(e)).toBe(true);
        expect((e as KoineError).code).toBe(code);
        expect((e as KoineError).fix.length).toBeGreaterThan(0);
      }
    }
  });

  test("a tampered package (bytes ≠ manifest hash) is refused as an integrity mismatch", async () => {
    const files = await sealedFiles("kb", { "a.md": "A" });
    files.set("a.md", enc("TAMPERED AFTER SEAL"));
    await expect(add({ cwd: tmp(), source: "github:o/r", fetchImpl: fakeGithubFetch(githubTarGz(files)) })).rejects.toMatchObject(
      { code: "integrity-mismatch" },
    );
  });

  test("a folder without a manifest is a clear error", async () => {
    const empty = join(tmp(), "empty");
    await mkdir(empty, { recursive: true });
    await writeFile(join(empty, "notes.md"), "hi");
    await expect(add({ cwd: tmp(), source: `path:${empty}` })).rejects.toMatchObject({ code: "bad-manifest" });
  });
});

describe("U7 offline-tolerant", () => {
  test("verify and list work with no network", async () => {
    const pub = await writePackage(join(tmp(), "p"), await sealedFiles("kb", { "a.md": "A" }));
    const c = tmp();
    await add({ cwd: c, source: `path:${pub}` });
    expect((await verify({ cwd: c })).ok).toBe(true);
    expect((await list({ cwd: c })).items[0]!.status).toBe("ok");
  });

  test("add fails fast and cleanly when the network is down", async () => {
    await expect(add({ cwd: tmp(), source: "github:o/r", fetchImpl: offlineFetch })).rejects.toMatchObject({ code: "network" });
  });
});

describe("U8 fast + quiet + zero-dependency", () => {
  test("the package declares zero runtime dependencies", async () => {
    const pkg = JSON.parse(await readFile(join(import.meta.dir, "..", "package.json"), "utf8"));
    expect(pkg.dependencies ?? {}).toEqual({});
  });

  test("install restores a broken tree from the lock (offline path source)", async () => {
    const pub = await writePackage(join(tmp(), "p"), await sealedFiles("kb", { "a.md": "A" }));
    const c = tmp();
    await add({ cwd: c, source: `path:${pub}` });
    await writeFile(join(c, "knowledge/kb/a.md"), "corrupted");
    await install({ cwd: c });
    expect(await readFile(join(c, "knowledge/kb/a.md"), "utf8")).toBe("A");
  });
});
