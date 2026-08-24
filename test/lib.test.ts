/**
 * The library surface (`import … from "koineformat"`), exercised exactly as an
 * embedder would: through `src/lib.ts`, in memory, with no filesystem anywhere.
 *
 * The last block is the one that makes the promise mechanical — it walks the
 * real import graph of the library entry and fails if anything reachable from it
 * is a `node:` builtin or a third-party package. That is what lets this code
 * import unchanged into a Cloudflare Worker.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import {
  contentsDigest,
  emptyLock,
  inspectFiles,
  lockEntryFor,
  parseLockfile,
  parseManifest,
  sealPackage,
  serializeLockfile,
  serializeManifest,
  sha256,
  sha256HexDigest,
  validateManifest,
  verifyIntegrity,
  type Manifest,
  type ResolvedPackage,
} from "../src/lib.js";

import { sealedFiles } from "./helpers.js";

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

/** A package's files with a bare, unsealed v0 manifest — what a migrating author starts from. */
function draft(content: Record<string, string>, name = "kb"): Map<string, Uint8Array> {
  const files = new Map<string, Uint8Array>();
  for (const [p, c] of Object.entries(content)) files.set(p, enc(c));
  files.set("pin.json", enc(JSON.stringify({ pin: "0", name, version: "2026.07.0", contents: [] })));
  return files;
}

describe("lib: manifest validation", () => {
  test("accepts a well-formed v0 manifest and returns a typed one", () => {
    const m = validateManifest({
      pin: "0",
      name: "team-decisions",
      version: "2026.07.0",
      contents: [{ path: "a.md", integrity: "sha256-x" }],
    });
    expect(m.name).toBe("team-decisions");
    expect(m.contents[0]!.path).toBe("a.md");
  });

  test("carries unknown fields through untouched (the envelope is thin)", () => {
    const m = validateManifest({ pin: "0", name: "kb", version: "1", contents: [], house: "rules" }) as Manifest & {
      house?: string;
    };
    expect(m.house).toBe("rules");
  });

  test("each rejection names its offending field and its fix", () => {
    const cases: Array<[unknown, string]> = [
      ["not an object", "bad-manifest"],
      [{ name: "kb", version: "1", contents: [] }, "bad-manifest"], // no "pin"
      [{ pin: "1", name: "kb", version: "1", contents: [] }, "unsupported-spec"],
      [{ pin: "0", name: "Bad Name", version: "1", contents: [] }, "bad-manifest"],
      [{ pin: "0", name: "kb", version: "", contents: [] }, "bad-manifest"],
      [{ pin: "0", name: "kb", version: "1" }, "bad-manifest"], // contents missing
      [{ pin: "0", name: "kb", version: "1", contents: [{ path: "../escape.md", integrity: "sha256-x" }] }, "path-traversal"],
      [{ pin: "0", name: "kb", version: "1", contents: [{ path: "pin.json", integrity: "sha256-x" }] }, "bad-manifest"],
      [{ pin: "0", name: "kb", version: "1", contents: [{ path: "a.md" }] }, "bad-manifest"], // no integrity
    ];
    for (const [value, code] of cases) {
      expect(() => validateManifest(value)).toThrow();
      try {
        validateManifest(value);
      } catch (e) {
        expect((e as { code: string }).code).toBe(code);
        expect((e as { fix: string }).fix.length).toBeGreaterThan(0);
      }
    }
  });

  test("parse → serialize → parse is stable", () => {
    const text = serializeManifest(
      validateManifest({ pin: "0", name: "kb", version: "1", contents: [{ path: "a.md", integrity: "sha256-x" }] }),
    );
    expect(text.endsWith("\n")).toBe(true);
    expect(serializeManifest(parseManifest(text))).toBe(text);
  });

  test("invalid JSON is a typed error, not a SyntaxError", () => {
    expect(() => parseManifest("{ nope")).toThrow(/not valid JSON/);
  });
});

describe("lib: integrity", () => {
  // The canonical SHA-256 vectors, in the SRI encoding the spec uses. These pin
  // the digest *string* — the hand-rolled base64 and WebCrypto must agree with
  // every other implementation, byte for byte.
  test("known vectors", async () => {
    expect(await sha256(enc(""))).toBe("sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=");
    expect(await sha256(enc("abc"))).toBe("sha256-ungWv48Bz+pBQUDeXa4iI7ADYaOWF3qctBD/YfIAFa0=");
  });

  test("base64 padding is correct at every input length mod 3", async () => {
    for (const s of ["a", "ab", "abc", "abcd", "abcde", "abcdef"]) {
      const d = await sha256(enc(s));
      expect(d).toMatch(/^sha256-[A-Za-z0-9+/]{43}=$/); // 32 bytes → 43 chars + one pad
    }
  });

  test("verifyIntegrity accepts the true digest and refuses everything else", async () => {
    const bytes = enc("Never deploy on Friday.");
    expect(await verifyIntegrity(bytes, await sha256(bytes))).toBe(true);
    expect(await verifyIntegrity(bytes, await sha256(enc("something else")))).toBe(false);
    expect(await verifyIntegrity(bytes, "sha512-whatever")).toBe(false); // unsupported algo
    expect(await verifyIntegrity(bytes, "malformed")).toBe(false);
  });

  test("the package fingerprint ignores file order", async () => {
    const a = [{ path: "a", integrity: "sha256-1" }, { path: "b", integrity: "sha256-2" }];
    expect(await contentsDigest(a)).toBe(await contentsDigest([...a].reverse()));
  });
});

describe("lib: seal → verify, entirely in memory (the koine form)", () => {
  test("sealing emits the koine form and it verifies clean — migrating the v0 draft away", async () => {
    const files = draft({ "conventions.md": "Never deploy on Friday.", "notes/why.md": "Because." });
    const { manifest, nodeCount, migratedFromV0 } = await sealPackage(files, {
      now: new Date("2026-07-22T00:00:00.000Z"),
    });

    expect(migratedFromV0).toBe(true); // draft() starts from a v0 pin.json
    expect(nodeCount).toBe(2);
    expect(manifest.koine).toBe("0");
    expect(manifest.pin).toBeUndefined();
    expect(manifest.contents).toBeUndefined();
    expect(manifest.integrity!.startsWith("sha256:")).toBe(true);
    expect(manifest.provenance?.published_at).toBe("2026-07-22T00:00:00.000Z");
    expect(files.has("pin.json")).toBe(false); // emit new, read old (SPEC §7.11)
    expect(files.has(".koine/nodes.jsonl")).toBe(true);

    files.set("koine.json", enc(serializeManifest(manifest)));
    const insp = await inspectFiles(files);
    expect(insp.status).toBe("ok");
    expect(insp.rootMatches).toBe(true);
    expect(insp.report?.ok).toBe(true);
    expect(insp.lockMatches).toBeUndefined(); // nothing to compare against
  });

  test("sealing is deterministic — same bytes, same clock, same manifest and map (U2)", async () => {
    const now = new Date("2026-07-22T00:00:00.000Z");
    const filesOne = draft({ "a.md": "A" });
    const filesTwo = draft({ "a.md": "A" });
    const one = await sealPackage(filesOne, { now });
    const two = await sealPackage(filesTwo, { now });
    expect(serializeManifest(one.manifest)).toBe(serializeManifest(two.manifest));
    expect(filesOne.get(".koine/nodes.jsonl")).toEqual(filesTwo.get(".koine/nodes.jsonl"));
  });

  test("re-sealing keeps existing node ids — an id survives a content edit", async () => {
    const now = new Date("2026-07-22T00:00:00.000Z");
    const files = draft({ "a.md": "A" });
    const first = await sealPackage(files, { now });
    files.set("koine.json", enc(serializeManifest(first.manifest)));
    const idBefore = new TextDecoder().decode(files.get(".koine/nodes.jsonl")!);

    files.set("a.md", enc("A, revised"));
    await sealPackage(files, { now });
    const after = new TextDecoder().decode(files.get(".koine/nodes.jsonl")!);
    expect(after).not.toBe(idBefore); // the contentHash moved…
    expect(after.match(/"id":"([^"]+)"/)![1]).toBe(idBefore.match(/"id":"([^"]+)"/)![1]); // …the id did not
  });

  test("a tampered byte shows up as modified — the root convicts, the map names the file", async () => {
    const files = draft({ "a.md": "A" });
    const { manifest } = await sealPackage(files);
    files.set("koine.json", enc(serializeManifest(manifest)));

    files.set("a.md", enc("TAMPERED"));
    const insp = await inspectFiles(files);
    expect(insp.status).toBe("modified");
    expect(insp.rootMatches).toBe(false);
    expect(insp.report?.mismatched).toEqual(["a.md"]);
  });

  test("an added file shows up as unlisted; a removed one as missing; sidecars never as unlisted", async () => {
    const base = draft({ "a.md": "A" });
    const { manifest } = await sealPackage(base);
    base.set("koine.json", enc(serializeManifest(manifest)));

    const extra = new Map(base);
    extra.set("uninvited.md", enc("hi"));
    const extraInsp = await inspectFiles(extra);
    expect(extraInsp.report?.unlisted).toEqual(["uninvited.md"]);
    expect(extraInsp.rootMatches).toBe(false);

    const gone = new Map(base);
    gone.delete("a.md");
    expect((await inspectFiles(gone)).report?.missing).toEqual(["a.md"]);
  });

  test("a package carrying BOTH manifests is refused as ambiguous (SPEC §7.11)", async () => {
    const files = draft({ "a.md": "A" });
    const { manifest } = await sealPackage(files);
    files.set("koine.json", enc(serializeManifest(manifest)));
    files.set("pin.json", enc(JSON.stringify({ pin: "0", name: "kb", version: "1", contents: [] })));
    const insp = await inspectFiles(files, { where: "knowledge/kb" });
    expect(insp.status).toBe("error");
    expect(insp.message).toContain("ambiguous");
  });

  test("a package with no manifest is an error, not a throw", async () => {
    const insp = await inspectFiles(new Map([["a.md", enc("A")]]), { where: "knowledge/kb" });
    expect(insp.status).toBe("error");
    expect(insp.message).toContain("knowledge/kb");
  });
});

describe("lib: lockfile", () => {
  test("a row round-trips through serialize → parse unchanged — the lock pins the manifest bytes", async () => {
    const files = draft({ "a.md": "A" });
    const { manifest } = await sealPackage(files);
    files.set("koine.json", enc(serializeManifest(manifest)));

    const pkg: ResolvedPackage = {
      manifest,
      files,
      resolved: { type: "git", url: "https://github.com/acme/kb", ref: "a".repeat(40), subpath: "." },
      requested: "github:acme/kb",
    };
    const entry = await lockEntryFor(pkg, "knowledge/kb");
    expect(entry.integrity).toBe(await sha256HexDigest(files.get("koine.json")!));

    const lock = emptyLock();
    lock.packages["kb"] = entry;
    const text = serializeLockfile(lock);
    expect(text.endsWith("\n")).toBe(true);
    expect(parseLockfile(JSON.parse(text))).toEqual(lock);
  });

  test("the fingerprint is what verify compares against", async () => {
    const files = draft({ "a.md": "A" });
    const { manifest } = await sealPackage(files);
    files.set("koine.json", enc(serializeManifest(manifest)));
    const fingerprint = await sha256HexDigest(files.get("koine.json")!);

    const good = await inspectFiles(files, { expectedIntegrity: fingerprint });
    expect(good.status).toBe("ok");
    expect(good.lockMatches).toBe(true);

    const bad = await inspectFiles(files, { expectedIntegrity: "sha256:somethingelse" });
    expect(bad.status).toBe("modified");
    expect(bad.lockMatches).toBe(false);
    expect(bad.report?.ok).toBe(true); // the files are fine; the lock disagrees
  });

  test("a v0 lock row still verifies a v0 package — read old (SPEC §7.11)", async () => {
    const files = await sealedFiles("kb", { "a.md": "A" });
    const manifest = parseManifest(new TextDecoder().decode(files.get("pin.json")!));
    const fingerprint = await contentsDigest(manifest.contents ?? []);
    const good = await inspectFiles(files, { expectedIntegrity: fingerprint });
    expect(good.status).toBe("ok");
    expect(good.lockMatches).toBe(true);
  });

  test("a missing `packages` map is tolerated; a non-object lockfile is refused", () => {
    expect(parseLockfile({ pin: "0" }).packages).toEqual({});
    expect(parseLockfile({}).koine).toBe("0");
    expect(() => parseLockfile("nope")).toThrow(/lockfile is invalid/);
    expect(() => parseLockfile([])).toThrow(/lockfile is invalid/);
  });
});

// ── The worker-safety guarantee, made mechanical ───────────────────────────

const ROOT = resolve(import.meta.dir, "..");

/**
 * Drop comments, so a usage example inside a doc block is not mistaken for a
 * real import. `(?<!:)` keeps `https://…` inside string literals intact.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(?<!:)\/\/.*$/gm, "");
}

/**
 * Every module specifier a source text imports or re-exports from.
 *
 * The `(?<!["'])` lookbehind is load-bearing: without it a *string literal*
 * holding the word `from` reads as an import keyword — `['from', 'to']` matches
 * as `from` + `'` + `, ` + `'`, convicting a specifier of `", "`. The koine seed
 * trips exactly that on its literal `from` field. Pin does not today, which is
 * why the falsification block below asserts the behaviour rather than the colour.
 */
export function specifiersIn(source: string): string[] {
  const stripped = stripComments(source);
  const out: string[] = [];
  const patterns = [
    /(?<!["'])\bfrom\s*["']([^"']+)["']/g, // import … from "x" · export … from "x"
    /(?<!["'])\bimport\s*\(\s*["']([^"']+)["']\s*\)/g, // dynamic import("x")
    /^\s*import\s+["']([^"']+)["']/gm, // bare side-effect import "x" (line-anchored)
    /(?<!["'])\brequire\s*\(\s*["']([^"']+)["']\s*\)/g, // createRequire escape hatch
  ];
  for (const re of patterns) {
    for (const m of stripped.matchAll(re)) out.push(m[1]!);
  }
  return out;
}

/** Every module specifier a file imports or re-exports from. */
function specifiersOf(file: string): string[] {
  return specifiersIn(readFileSync(file, "utf8"));
}

/**
 * Walk the import graph from `entry`, returning every non-relative specifier it
 * can reach. `toFile` maps a relative specifier to a real file on disk.
 */
function reachableExternals(entry: string, toFile: (from: string, spec: string) => string): Map<string, string[]> {
  const externals = new Map<string, string[]>(); // specifier → importing files
  const seen = new Set<string>();
  const queue = [entry];

  while (queue.length > 0) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);

    for (const spec of specifiersOf(file)) {
      if (spec.startsWith(".")) {
        queue.push(toFile(file, spec));
        continue;
      }
      const importers = externals.get(spec) ?? [];
      importers.push(relative(ROOT, file));
      externals.set(spec, importers);
    }
  }
  return externals;
}

describe("lib: the import-graph extractor itself", () => {
  // A guard that under-reports is worse than no guard: it reports green while a
  // node: import walks past. So the extractor is falsified in both directions
  // rather than trusted because the suite is green.

  test("convicts every real import form", () => {
    expect(specifiersIn(`import { readFileSync } from "node:fs";`)).toEqual(["node:fs"]);
    expect(specifiersIn(`import x from 'some-dependency';`)).toEqual(["some-dependency"]);
    expect(specifiersIn(`export { a } from "./relative.js";`)).toEqual(["./relative.js"]);
    expect(specifiersIn(`export type { T } from "node:stream";`)).toEqual(["node:stream"]);
    expect(specifiersIn(`const m = await import("node:zlib");`)).toEqual(["node:zlib"]);
    expect(specifiersIn(`import "node:process";`)).toEqual(["node:process"]);
    expect(specifiersIn(`const r = createRequire(u); r; require("node:path");`)).toEqual(["node:path"]);
  });

  test("does not convict the word `from` inside a string literal", () => {
    // The exact shape that trips the naive pattern: `'from', 'to'` matches as
    // from + quote + ", " + quote, yielding a phantom specifier of `", "`.
    expect(specifiersIn(`const EDGE_KEYS = ['from', 'to', 'type'];`)).toEqual([]);
    expect(specifiersIn(`const row = { "from": "a", "to": "b" };`)).toEqual([]);
    expect(specifiersIn(`const msg = "import 'node:fs' to continue";`)).toEqual([]);
    expect(specifiersIn(`const help = "require('node:path') is banned";`)).toEqual([]);
  });

  test("does not convict imports written inside comments", () => {
    expect(specifiersIn(`/** Usage: import { x } from "koineformat" */`)).toEqual([]);
    expect(specifiersIn(`// import { readFileSync } from "node:fs"`)).toEqual([]);
  });

  test("keeps a URL in a string intact while stripping real line comments", () => {
    // The comment stripper must not eat `https://…`; if it did, a following
    // import on the same line would vanish and the guard would under-report.
    expect(specifiersIn(`const API = "https://api.github.com";\nimport "node:fs";`)).toEqual(["node:fs"]);
  });
});

describe("lib: worker-safe by construction", () => {
  test("nothing reachable from src/lib.ts is a node: builtin or a dependency", () => {
    // Source graph: "./core/x.js" is emitted from "./core/x.ts".
    const externals = reachableExternals(join(ROOT, "src/lib.ts"), (from, spec) =>
      join(dirname(from), spec.replace(/\.js$/, ".ts")),
    );
    expect([...externals.keys()]).toEqual([]);
  });

  test("the CLI is what holds the node: imports — they exist, just not on the library path", () => {
    const externals = reachableExternals(join(ROOT, "src/koine.ts"), (from, spec) =>
      join(dirname(from), spec.replace(/\.js$/, ".ts")),
    );
    const builtins = [...externals.keys()].filter((s) => s.startsWith("node:"));
    expect(builtins.length).toBeGreaterThan(0);
    expect([...externals.keys()].filter((s) => !s.startsWith("node:"))).toEqual([]); // still zero deps (U8)
  });

  test("the built dist/lib.js graph is clean too", () => {
    const entry = join(ROOT, "dist/lib.js");
    if (!existsSync(entry)) return; // not built yet (CI tests before it builds)
    const externals = reachableExternals(entry, (from, spec) => join(dirname(from), spec));
    expect([...externals.keys()]).toEqual([]);
  });
});
