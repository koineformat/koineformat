/**
 * The pure core of `koine seal` (SPEC §7.2 · §7.4): given a package's files in
 * memory, build/refresh the identity map (`.koine/nodes.jsonl` — ids minted
 * where none exist, kept where they do), compute ONE root hash over the
 * canonical tree listing, and emit the koine-form manifest with a stamped
 * provenance block. Hand-computing integrity hashes is inhuman; without seal
 * nobody can author a valid manifest. `version` stays human-set.
 *
 * A v0 package (`pin.json`) seals into the koine form in place: the manifest's
 * papers carry over, `contents[]` is replaced by the root hash, and `pin.json`
 * leaves the file set — emit new, read old (SPEC §7.11).
 *
 * The CLI walks the directory and writes the result back; a Worker can seal a
 * package it just assembled in memory and never touch a filesystem.
 */
import type { Manifest } from "./types.js";
import { SPEC_VERSION } from "./types.js";
import { MANIFEST_NAME, MANIFEST_NAME_V0, manifestFromFiles } from "./manifest.js";
import { rootHash } from "./integrity.js";
import { assertSafeRelPath } from "./paths.js";
import { sha256Hex } from "../sha256.js";
import { emitNodesJsonl, parseNodesJsonl } from "../sidecars.js";
import type { KoineNodeEntry } from "../types.js";

/** Where the identity map lives inside a package (SPEC §3.2 · §7.2). */
export const NODES_PATH = ".koine/nodes.jsonl";

/**
 * A body's `format` field, derived from its filename. The format dictionary is
 * a declared gap (SPEC, Declared gaps 3); until it exists this maps a handful
 * of text shapes and otherwise records the extension verbatim — a recording,
 * not a vocabulary.
 */
export function formatOf(path: string): string {
  const dot = path.lastIndexOf(".");
  const ext = dot >= 0 ? path.slice(dot + 1).toLowerCase() : "";
  if (ext === "md" || ext === "markdown" || ext === "txt" || ext === "text") return "text";
  if (ext === "jsonl") return "entries";
  return ext === "" ? "binary" : ext;
}

/** Deterministic first-mint of a node id: stable across seal runs (U2/U3). */
async function mintId(path: string, bytes: Uint8Array): Promise<string> {
  const pathDigest = await sha256Hex(path);
  const contentDigest = await sha256Hex(bytes);
  return `n-${(await sha256Hex(`${pathDigest}:${contentDigest}`)).slice(0, 12)}`;
}

/** True for the payload files the identity map lists — bodies, never sidecars. */
function isBody(path: string): boolean {
  return path !== MANIFEST_NAME && path !== MANIFEST_NAME_V0 && !path.startsWith(".koine/");
}

export interface SealPackageOptions {
  /** Named in the error when the file map has no manifest. */
  where?: string;
  /** Injectable clock, so a sealed manifest can be made byte-reproducible. */
  now?: Date;
}

export interface SealedPackage {
  /** The koine-form manifest, fields in canonical order. */
  manifest: Manifest;
  /** How many bodies the identity map lists. */
  nodeCount: number;
  /** True when the input carried the v0 dialect (`pin.json`) and was migrated. */
  migratedFromV0: boolean;
}

/**
 * Seal a package's file map IN PLACE. On return the map carries a fresh
 * `.koine/nodes.jsonl` and `koine.json`, and no `pin.json`. Existing node ids
 * are kept (matched by path — an id outlives a path only through renames the
 * live workspace tracks; a bare-tree seal cannot see a rename); new bodies get
 * deterministic ids.
 */
export async function sealPackage(
  files: Map<string, Uint8Array>,
  opts: SealPackageOptions = {},
): Promise<SealedPackage> {
  const source = manifestFromFiles(files, opts.where ?? "the package");
  const migratedFromV0 = source.pin !== undefined;

  // 1 — the identity map: keep existing ids by path, mint the rest (SPEC §7.2).
  const existing = new Map<string, KoineNodeEntry>();
  const nodesBytes = files.get(NODES_PATH);
  if (nodesBytes) {
    for (const row of parseNodesJsonl(new TextDecoder().decode(nodesBytes))) {
      existing.set(row.path, row);
    }
  }
  const bodyPaths = [...files.keys()].filter(isBody).sort();
  const rows: KoineNodeEntry[] = [];
  for (const path of bodyPaths) {
    assertSafeRelPath(path);
    const bytes = files.get(path)!;
    const prior = existing.get(path);
    rows.push({
      id: prior?.id ?? (await mintId(path, bytes)),
      path,
      format: prior?.format ?? formatOf(path),
      contentHash: `sha256:${await sha256Hex(bytes)}`,
    });
  }
  files.set(NODES_PATH, new TextEncoder().encode(emitNodesJsonl(rows)));

  // 2 — a migrating package leaves the v0 manifest behind BEFORE the root is
  // computed: the listing covers every file except koine.json (SPEC §7.4).
  if (migratedFromV0) files.delete(MANIFEST_NAME_V0);
  files.delete(MANIFEST_NAME); // never hash a stale manifest into its own root

  // 3 — the papers, in canonical field order; unknown fields carry through last.
  const {
    koine: _koine,
    pin: _pin,
    name,
    version,
    description,
    license,
    readingFloor,
    source: src,
    representations,
    provenance,
    integrity: _integrity,
    contents: _contents,
    ...rest
  } = source;
  const manifest: Manifest = {
    koine: SPEC_VERSION,
    name,
    version,
    ...(description !== undefined ? { description } : {}),
    ...(license !== undefined ? { license } : {}),
    ...(readingFloor !== undefined ? { readingFloor } : {}),
    ...(src !== undefined ? { source: src } : {}),
    ...(representations !== undefined ? { representations } : {}),
    provenance: {
      ...(provenance ?? {}),
      published_at: (opts.now ?? new Date()).toISOString(),
      method: provenance?.method ?? "none",
      signature: provenance?.signature ?? null,
    },
    integrity: await rootHash(files),
    ...rest,
  };

  return { manifest, nodeCount: rows.length, migratedFromV0 };
}
