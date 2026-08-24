/**
 * The manifest layer: parse + validate `pin.json`, compute `contents[]`
 * from raw files, and diff a manifest against a set of files. Shared by the
 * publisher (`seal`), the resolvers (validate what was fetched), and `verify`.
 *
 * Everything here works on in-memory bytes, never on a filesystem — the CLI does
 * the walking and hands the file map in.
 */
import type { ContentEntry, Manifest } from "./types.js";
import { SPEC_VERSION } from "./types.js";
import { errAmbiguousEnvelope, errBadManifest, errUnsupportedSpec } from "./errors.js";
import { assertSafeRelPath } from "./paths.js";
import { sha256, verifyIntegrity } from "./integrity.js";

/** The manifest filename at a package root (SPEC §7.3). */
export const MANIFEST_NAME = "koine.json";

/** The v0 dialect's manifest filename — read, never emitted (SPEC §7.11). */
export const MANIFEST_NAME_V0 = "pin.json";

/** The manifest file a package's file set actually carries; throws on both. */
export function manifestNameIn(files: ReadonlyMap<string, Uint8Array>, where: string): string | undefined {
  const hasKoine = files.has(MANIFEST_NAME);
  const hasV0 = files.has(MANIFEST_NAME_V0);
  if (hasKoine && hasV0) throw errAmbiguousEnvelope(where);
  return hasKoine ? MANIFEST_NAME : hasV0 ? MANIFEST_NAME_V0 : undefined;
}

/** SPEC §4.2: name MUST match this. */
export const NAME_RE = /^[a-z0-9][a-z0-9._-]*$/;

const MEDIA_BY_EXT: Record<string, string> = {
  md: "text/markdown",
  markdown: "text/markdown",
  json: "application/json",
  txt: "text/plain",
  text: "text/plain",
  yaml: "application/yaml",
  yml: "application/yaml",
  csv: "text/csv",
  html: "text/html",
  htm: "text/html",
  xml: "application/xml",
};

/** Best-effort IANA media type from a path's extension (informative only). */
export function guessMedia(path: string): string {
  const dot = path.lastIndexOf(".");
  const ext = dot >= 0 ? path.slice(dot + 1).toLowerCase() : "";
  return MEDIA_BY_EXT[ext] ?? "application/octet-stream";
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Validate an already-parsed value as a Manifest — the koine form (SPEC §7.3:
 * enforce `koine`, `name`, `version`, `integrity`) or the read-only v0 dialect
 * (enforce `pin`, `name`, `version`, `contents` with per-entry path safety).
 * Throws a KoineError (U6) that names the exact offending field. Refuses a spec
 * major version we don't grok, and a value carrying both version fields.
 */
export function validateManifest(value: unknown): Manifest {
  if (!isObject(value)) throw errBadManifest("top level is not a JSON object");

  const koine = value["koine"];
  const pin = value["pin"];
  if (koine !== undefined && pin !== undefined) {
    throw errBadManifest(`a manifest carries "koine" OR "pin" (spec version), never both`);
  }
  const specField = koine !== undefined ? "koine" : "pin";
  const spec = koine ?? pin;
  if (typeof spec !== "string") throw errBadManifest(`"koine" (spec version) is required`);
  const major = spec.split(".")[0];
  if (major !== SPEC_VERSION) throw errUnsupportedSpec(spec);

  const name = value["name"];
  if (typeof name !== "string" || !NAME_RE.test(name)) {
    throw errBadManifest(`"name" must match ${NAME_RE.source}`);
  }

  const version = value["version"];
  if (typeof version !== "string" || version.length === 0) {
    throw errBadManifest(`"version" is required (an opaque, orderable label)`);
  }

  if (specField === "koine") {
    // The koine form: ONE root hash. Presence is enforced here; well-formedness
    // is established at verification, exactly like the v0 digests (SPEC §7.3).
    const integrity = value["integrity"];
    if (typeof integrity !== "string") {
      throw errBadManifest(`"integrity" (the root hash, "sha256:<hex>") is required`);
    }
    return { ...value, koine: spec, name, version, integrity } as Manifest;
  }

  const rawContents = value["contents"];
  if (!Array.isArray(rawContents)) throw errBadManifest(`"contents" must be an array`);
  const contents: ContentEntry[] = rawContents.map((entry, i): ContentEntry => {
    if (!isObject(entry)) throw errBadManifest(`contents[${i}] is not an object`);
    const p = entry["path"];
    if (typeof p !== "string") throw errBadManifest(`contents[${i}].path is required`);
    assertSafeRelPath(p);
    if (p === MANIFEST_NAME_V0) throw errBadManifest(`contents must not list ${MANIFEST_NAME_V0} itself`);
    const integrity = entry["integrity"];
    if (typeof integrity !== "string") throw errBadManifest(`contents[${i}].integrity is required`);
    const media = entry["media"];
    if (media !== undefined && typeof media !== "string") {
      throw errBadManifest(`contents[${i}].media must be a string`);
    }
    return media === undefined ? { path: p, integrity } : { path: p, media, integrity };
  });

  // Carry the whole validated object through, but with a typed, checked core.
  return { ...value, pin: spec, name, version, contents } as Manifest;
}

/** Parse manifest JSON text, then validate it. */
export function parseManifest(text: string): Manifest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw errBadManifest(`the manifest is not valid JSON (${(e as Error).message})`);
  }
  return validateManifest(parsed);
}

/** The on-the-wire bytes of a manifest: pretty JSON with a trailing newline. */
export function serializeManifest(manifest: Manifest): string {
  return JSON.stringify(manifest, null, 2) + "\n";
}

/**
 * Extract + validate the manifest from a package's file set — `koine.json`, or
 * the v0 dialect's `pin.json` (SPEC §7.11). A set carrying both is refused.
 */
export function manifestFromFiles(files: Map<string, Uint8Array>, where: string): Manifest {
  const name = manifestNameIn(files, where);
  if (!name) throw errBadManifest(`no ${MANIFEST_NAME} (or v0 ${MANIFEST_NAME_V0}) at the root of ${where}`);
  return parseManifest(new TextDecoder().decode(files.get(name)!));
}

/**
 * Compute a v0-dialect `contents[]` for every file except the manifests.
 * Deterministic: entries are sorted by path. Kept for READING-side tests and
 * fixtures of the v0 dialect — the emit side is the root hash (SPEC §7.4).
 */
export async function computeContents(files: Map<string, Uint8Array>): Promise<ContentEntry[]> {
  const pending: Array<Promise<ContentEntry>> = [];
  for (const [path, bytes] of files) {
    if (path === MANIFEST_NAME || path === MANIFEST_NAME_V0) continue;
    assertSafeRelPath(path);
    pending.push(sha256(bytes).then((integrity) => ({ path, media: guessMedia(path), integrity })));
  }
  const entries = await Promise.all(pending);
  entries.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return entries;
}

/** The result of checking a manifest against a concrete set of files. */
export interface ContentsReport {
  /** Listed in the manifest but absent from the files. */
  missing: string[];
  /** Present, but bytes do not match the recorded hash. */
  mismatched: string[];
  /** Present on disk but not listed in the manifest (excludes the manifest). */
  unlisted: string[];
  ok: boolean;
}

/**
 * Pure diff of a manifest's per-file listing against a file set. Never throws
 * on mismatch. The listing is the v0 dialect's `contents[]`, or — for the koine
 * form — the identity-map rows the caller extracted (SPEC §7.4: the map is what
 * names WHICH file).
 */
export async function checkContents(
  files: Map<string, Uint8Array>,
  listing: ReadonlyArray<Pick<ContentEntry, "path" | "integrity">>,
): Promise<ContentsReport> {
  const missing: string[] = [];
  const mismatched: string[] = [];
  const listed = new Set<string>();

  const checks = listing.map(async (entry) => {
    listed.add(entry.path);
    const bytes = files.get(entry.path);
    if (!bytes) return { path: entry.path, verdict: "missing" as const };
    const ok = await verifyIntegrity(bytes, entry.integrity);
    return { path: entry.path, verdict: ok ? ("ok" as const) : ("mismatched" as const) };
  });

  for (const r of await Promise.all(checks)) {
    if (r.verdict === "missing") missing.push(r.path);
    else if (r.verdict === "mismatched") mismatched.push(r.path);
  }

  const unlisted: string[] = [];
  for (const path of files.keys()) {
    if (path === MANIFEST_NAME || path === MANIFEST_NAME_V0) continue;
    if (!listed.has(path)) unlisted.push(path);
  }
  missing.sort();
  mismatched.sort();
  unlisted.sort();
  return { missing, mismatched, unlisted, ok: missing.length + mismatched.length + unlisted.length === 0 };
}
