/**
 * Focused unit tests for the parsing/format layer that underpins the invariants.
 */
import { describe, expect, test } from "bun:test";
import { buildTar, gzip, sealedFiles } from "./helpers.js";
import { extractTarGz, parseTar } from "../src/tar.js";
import { parseSource } from "../src/sources.js";
import { checkContents, computeContents, manifestFromFiles, validateManifest } from "../src/core/manifest.js";

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

describe("tar", () => {
  test("roundtrips a nested file", () => {
    const entries = parseTar(buildTar([{ name: "d/a.md", data: enc("hello") }]));
    const f = entries.find((e) => e.path === "d/a.md")!;
    expect(f.type).toBe("file");
    expect(new TextDecoder().decode(f.data)).toBe("hello");
  });

  test("surfaces a symlink as a typed entry (so the caller can refuse it)", () => {
    const entries = parseTar(buildTar([{ name: "l", type: "2", linkname: "/etc/passwd" }]));
    expect(entries[0]!.type).toBe("symlink");
  });

  test("extractTarGz gunzips then parses", () => {
    const entries = extractTarGz(gzip(buildTar([{ name: "a", data: enc("x") }])));
    expect(entries[0]!.path).toBe("a");
  });
});

describe("source grammar", () => {
  test("github with subpath + ref", () => {
    expect(parseSource("github:koineformat/koineformat/examples/team-decisions#v2")).toEqual({
      kind: "github",
      owner: "koineformat",
      repo: "koineformat",
      subpath: "examples/team-decisions",
      ref: "v2",
    });
  });
  test("bare github", () => {
    expect(parseSource("github:o/r")).toEqual({ kind: "github", owner: "o", repo: "r", subpath: "" });
  });
  test("path", () => {
    expect(parseSource("path:../x")).toEqual({ kind: "path", path: "../x" });
  });
  test("unsupported forms throw", () => {
    expect(() => parseSource("https://x/y.tgz")).toThrow();
    expect(() => parseSource("git+https://x")).toThrow();
    expect(() => parseSource("bare-name")).toThrow();
  });
});

describe("manifest", () => {
  test("refuses an unknown spec major version", () => {
    expect(() => validateManifest({ pin: "1", name: "x", version: "1", contents: [] })).toThrow();
  });
  test("refuses an invalid name", () => {
    expect(() => validateManifest({ pin: "0", name: "Bad Name", version: "1", contents: [] })).toThrow();
  });
  test("computeContents is sorted, hashed, and excludes the manifest", async () => {
    const files = new Map([["b.md", enc("B")], ["a.md", enc("A")], ["pin.json", enc("{}")]]);
    const c = await computeContents(files);
    expect(c.map((e) => e.path)).toEqual(["a.md", "b.md"]);
    expect(c[0]!.integrity.startsWith("sha256-")).toBe(true);
  });
  test("checkContents flags an unlisted file", async () => {
    const files = await sealedFiles("kb", { "a.md": "A" });
    const manifest = manifestFromFiles(files, "x");
    files.set("extra.md", enc("E"));
    const r = await checkContents(files, manifest.contents ?? []);
    expect(r.unlisted).toContain("extra.md");
    expect(r.ok).toBe(false);
  });
});
