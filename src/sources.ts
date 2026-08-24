/**
 * Source grammar (SPEC §6.1 subset) + resolution. v0 supports exactly two forms:
 *
 *   github:owner/repo[/sub/path][#ref]   — fetched as a codeload tarball; no git
 *                                          binary required; the lock pins the SHA.
 *   path:../local/folder                 — vendored from the local filesystem.
 *
 * Everything else (git+https, https tarball, bare registry names) is refused with
 * a message that names the supported forms (U6). Resolution ends in a
 * ResolvedPackage: the exact bytes to vendor, byte-identical to the sealed source.
 */
import { resolve } from "node:path";
import type { LockEntry, ResolvedPackage, ResolvedRef } from "./core/types.js";
import { manifestDialect } from "./core/types.js";
import {
  errBadManifest,
  errIntegrityMismatch,
  errNetwork,
  errRefNotFound,
  errRootMismatch,
  errUnknownSource,
  errUnsafeEntry,
} from "./core/errors.js";
import { assertSafeRelPath, assertWithinCaps } from "./core/paths.js";
import { checkContents, manifestFromFiles, MANIFEST_NAME_V0 } from "./core/manifest.js";
import { rootHash } from "./core/integrity.js";
import { NODES_PATH } from "./core/seal.js";
import { parseNodesJsonl } from "./sidecars.js";
import { readTree } from "./fsx.js";
import { extractTarGz, type TarEntry } from "./tar.js";

export type SourceSpec =
  | { kind: "github"; owner: string; repo: string; subpath: string; ref?: string }
  | { kind: "path"; path: string };

/** A minimal structural subset of the global `fetch`, so tests can inject one. */
export type FetchLike = (
  url: string,
  init?: { headers?: Record<string, string> },
) => Promise<{
  ok: boolean;
  status: number;
  statusText: string;
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
}>;

export interface ResolveCtx {
  cwd: string;
  fetchImpl?: FetchLike;
}

export interface ResolveResult {
  pkg: ResolvedPackage;
  /** Non-fatal notes (e.g. files present in the source but not in the manifest). */
  warnings: string[];
}

// ── Parsing ────────────────────────────────────────────────────────────────

/** Parse a source string into a typed spec, or throw errUnknownSource (U6). */
export function parseSource(src: string): SourceSpec {
  if (src.startsWith("github:")) return parseGithub(src.slice("github:".length));
  if (src.startsWith("path:")) {
    const p = src.slice("path:".length);
    if (p.length === 0) throw errUnknownSource(src);
    return { kind: "path", path: p };
  }
  // Deferred/unsupported forms fall through to a helpful error.
  throw errUnknownSource(src);
}

function parseGithub(rest: string): SourceSpec {
  const hash = rest.indexOf("#");
  const ref = hash >= 0 ? rest.slice(hash + 1) : undefined;
  const loc = hash >= 0 ? rest.slice(0, hash) : rest;
  const segs = loc.split("/").filter((s) => s.length > 0);
  const owner = segs[0];
  const repo = segs[1];
  if (!owner || !repo) throw errUnknownSource(`github:${rest}`);
  const subpath = segs.slice(2).join("/");
  const spec: SourceSpec = { kind: "github", owner, repo, subpath };
  if (ref && ref.length > 0) return { ...spec, ref };
  return spec;
}

// ── Subtree selection (shared by github extraction) ────────────────────────

function normalizeSub(subpath: string): string {
  return subpath.replace(/^\.?\/+/, "").replace(/\/+$/, "").replace(/^\.$/, "");
}

/**
 * From a flat list of tar entries, strip the archive's single top-level dir,
 * keep only what lives under `subpath`, and return package-relative files.
 * Symlinks/hardlinks/special files *within the subtree* are refused (U4);
 * anything outside it is ignored.
 */
function subtreeFiles(entries: TarEntry[], subpath: string): Map<string, Uint8Array> {
  const firstSegs = new Set<string>();
  for (const e of entries) {
    if (e.type === "dir") continue;
    firstSegs.add(e.path.split("/")[0] ?? "");
  }
  const root = firstSegs.size === 1 ? [...firstSegs][0]! : null;
  const want = normalizeSub(subpath);

  const files = new Map<string, Uint8Array>();
  for (const e of entries) {
    if (e.type === "dir") continue;
    let rel = e.path;
    if (root !== null && (rel === root || rel.startsWith(root + "/"))) {
      rel = rel.slice(root.length).replace(/^\/+/, "");
    }
    if (rel === "") continue;

    let pkgRel: string;
    if (want === "") pkgRel = rel;
    else if (rel.startsWith(want + "/")) pkgRel = rel.slice(want.length + 1);
    else continue; // outside the requested subpath

    if (e.type !== "file") throw errUnsafeEntry(pkgRel, e.type);
    assertSafeRelPath(pkgRel);
    files.set(pkgRel, e.data);
  }
  return files;
}

// ── Shared validation → ResolvedPackage ────────────────────────────────────

/**
 * Turn a raw source file set into a validated, sealed-tree ResolvedPackage —
 * fail-closed (U4): nothing vendors unless the envelope's integrity holds.
 *
 * Koine form: the ONE root hash must match the tree, the identity map must be
 * present (SPEC §7.2) and every mapped body must match its hash; the vendored
 * tree is the whole sealed set. v0 dialect (read-old, SPEC §7.11): per-file
 * `contents[]` verify, and the vendored tree is exactly the declared set —
 * unlisted files are reported and omitted.
 */
async function buildResolvedPackage(
  sourceFiles: Map<string, Uint8Array>,
  requested: string,
  resolved: ResolvedRef,
  where: string,
): Promise<ResolveResult> {
  const manifest = manifestFromFiles(sourceFiles, where);

  if (manifestDialect(manifest) === "koine") {
    if ((await rootHash(sourceFiles)) !== manifest.integrity) throw errRootMismatch(where);
    const nodesBytes = sourceFiles.get(NODES_PATH);
    if (!nodesBytes) {
      throw errBadManifest(
        `the package carries no ${NODES_PATH} — a koine-form package ships its identity map (SPEC §7.2)`,
      );
    }
    const listing = parseNodesJsonl(new TextDecoder().decode(nodesBytes)).map((row) => ({
      path: row.path,
      integrity: row.contentHash,
    }));
    const report = await checkContents(sourceFiles, listing);
    if (report.mismatched.length > 0) {
      throw errIntegrityMismatch(report.mismatched[0]!, /* tamper */ true);
    }
    if (report.missing.length > 0) {
      throw errBadManifest(
        `the identity map lists file(s) missing from the source: ${report.missing.join(", ")} — the publisher must re-seal`,
      );
    }

    // The root covers the whole tree — vendor the whole sealed set.
    const files = new Map(sourceFiles);
    assertWithinCaps(files);
    return { pkg: { manifest, files, resolved, requested }, warnings: [] };
  }

  const report = await checkContents(sourceFiles, manifest.contents ?? []);

  if (report.mismatched.length > 0) {
    throw errIntegrityMismatch(report.mismatched[0]!, /* tamper */ true);
  }
  if (report.missing.length > 0) {
    throw errBadManifest(
      `manifest lists file(s) missing from the source: ${report.missing.join(", ")} — the publisher must re-seal`,
    );
  }

  // Vendor exactly the sealed set: pin.json + every declared content file.
  const files = new Map<string, Uint8Array>();
  files.set(MANIFEST_NAME_V0, sourceFiles.get(MANIFEST_NAME_V0)!);
  for (const entry of manifest.contents ?? []) files.set(entry.path, sourceFiles.get(entry.path)!);
  assertWithinCaps(files);

  const warnings = report.unlisted.map(
    (p) => `${p} is present in the source but not listed in ${MANIFEST_NAME_V0}; it will not be vendored.`,
  );

  return { pkg: { manifest, files, resolved, requested }, warnings };
}

// ── github: resolver ───────────────────────────────────────────────────────

const GITHUB_API = "https://api.github.com";

function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "User-Agent": "koine-cli",
    Accept: "application/vnd.github+json",
  };
  const token = process.env["GITHUB_TOKEN"] ?? process.env["GH_TOKEN"];
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

function encodeRef(ref: string): string {
  return ref.split("/").map(encodeURIComponent).join("/");
}

async function tryFetch(
  fetchImpl: FetchLike,
  url: string,
  headers: Record<string, string>,
): ReturnType<FetchLike> {
  try {
    return await fetchImpl(url, { headers });
  } catch (e) {
    throw errNetwork(url, (e as Error).message);
  }
}

async function resolveGithub(spec: Extract<SourceSpec, { kind: "github" }>, ctx: ResolveCtx): Promise<ResolveResult> {
  const fetchImpl = ctx.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
  const { owner, repo } = spec;
  const ref = spec.ref ?? "HEAD";
  const slug = `github:${owner}/${repo}`;

  // 1. Resolve the ref to an immutable commit SHA (U2). `application/vnd.github.sha`
  //    returns the SHA as plain text.
  const shaUrl = `${GITHUB_API}/repos/${owner}/${repo}/commits/${encodeRef(ref)}`;
  const shaRes = await tryFetch(fetchImpl, shaUrl, { ...githubHeaders(), Accept: "application/vnd.github.sha" });
  if (shaRes.status === 404) throw errRefNotFound(ref, slug);
  if (!shaRes.ok) throw errNetwork(shaUrl, `${shaRes.status} ${shaRes.statusText}`);
  const sha = (await shaRes.text()).trim();

  // 2. Download the codeload tarball pinned at that SHA.
  const tarUrl = `https://codeload.github.com/${owner}/${repo}/tar.gz/${sha}`;
  const tarRes = await tryFetch(fetchImpl, tarUrl, githubHeaders());
  if (tarRes.status === 404) throw errRefNotFound(sha, slug);
  if (!tarRes.ok) throw errNetwork(tarUrl, `${tarRes.status} ${tarRes.statusText}`);
  const gz = new Uint8Array(await tarRes.arrayBuffer());

  const entries = extractTarGz(gz);
  const sourceFiles = subtreeFiles(entries, spec.subpath);

  const resolved: ResolvedRef = {
    type: "git",
    url: `https://github.com/${owner}/${repo}`,
    ref: sha,
    subpath: normalizeSub(spec.subpath) || ".",
  };
  const where = spec.subpath ? `${slug}/${normalizeSub(spec.subpath)}` : slug;
  return buildResolvedPackage(sourceFiles, sourceRequestedString(spec), resolved, where);
}

// ── path: resolver ─────────────────────────────────────────────────────────

async function resolvePath(spec: Extract<SourceSpec, { kind: "path" }>, ctx: ResolveCtx): Promise<ResolveResult> {
  const abs = resolve(ctx.cwd, spec.path);
  const sourceFiles = await readTree(abs); // rejects symlinks/special files (U4)
  const resolved: ResolvedRef = { type: "path", url: spec.path };
  return buildResolvedPackage(sourceFiles, `path:${spec.path}`, resolved, abs);
}

// ── Public entry point ─────────────────────────────────────────────────────

function sourceRequestedString(spec: Extract<SourceSpec, { kind: "github" }>): string {
  const sub = spec.subpath ? `/${normalizeSub(spec.subpath)}` : "";
  const ref = spec.ref ? `#${spec.ref}` : "";
  return `github:${spec.owner}/${spec.repo}${sub}${ref}`;
}

/** Parse + resolve a source string into a vendorable package. */
export async function resolveSource(src: string, ctx: ResolveCtx): Promise<ResolveResult> {
  const spec = parseSource(src);
  if (spec.kind === "github") return resolveGithub(spec, ctx);
  return resolvePath(spec, ctx);
}

/**
 * Re-resolve the *exact locked ref* (not a moving branch) so that the same lock
 * reproduces a byte-identical tree (U2). Used by `koine install`.
 */
export async function resolveLocked(entry: LockEntry, ctx: ResolveCtx): Promise<ResolveResult> {
  const r = entry.resolved;
  if (r.type === "git") {
    const m = /^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/.exec(r.url);
    if (!m) throw errUnknownSource(entry.requested);
    const subpath = r.subpath && r.subpath !== "." ? r.subpath : "";
    const spec: Extract<SourceSpec, { kind: "github" }> = { kind: "github", owner: m[1]!, repo: m[2]!, subpath };
    if (r.ref) return resolveGithub({ ...spec, ref: r.ref }, ctx);
    return resolveGithub(spec, ctx);
  }
  if (r.type === "path") return resolvePath({ kind: "path", path: r.url }, ctx);
  throw errUnknownSource(entry.requested);
}
