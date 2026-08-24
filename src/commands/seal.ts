/**
 * `koine seal` — build/refresh the identity map (`.koine/nodes.jsonl`), compute
 * the ONE root hash over the canonical tree listing, and write the koine-form
 * manifest with a stamped provenance block (SPEC §7.2 · §7.4). Hand-computing
 * integrity hashes is inhuman; without seal nobody can author a valid manifest.
 * `version` stays human-set.
 *
 * Sealing a v0 package (`pin.json`) migrates it in place: `koine.json` is
 * written, `pin.json` removed — emit new, read old (SPEC §7.11).
 *
 * The sealing itself is `core/seal.ts`; this is the directory walk around it.
 */
import { join, relative, resolve } from "node:path";
import { rm } from "node:fs/promises";
import { MANIFEST_NAME, MANIFEST_NAME_V0, manifestNameIn, serializeManifest } from "../core/manifest.js";
import { NODES_PATH, sealPackage } from "../core/seal.js";
import { pathExists, readTree, writeTextAtomic } from "../fsx.js";
import { errMissingManifest } from "../core/errors.js";

export interface SealOptions {
  cwd: string;
  dir?: string;
}

export interface SealResult {
  path: string;
  name: string;
  version: string;
  /** How many bodies the identity map lists. */
  nodeCount: number;
  /** True when a v0 `pin.json` was migrated to `koine.json` in this act. */
  migratedFromV0: boolean;
}

export async function seal(opts: SealOptions): Promise<SealResult> {
  const targetDir = resolve(opts.cwd, opts.dir ?? ".");
  const shownDir = relative(opts.cwd, targetDir) || ".";

  // Read the whole tree (rejects symlinks/special files, U4), then hand the bytes
  // to the envelope core: it validates the manifest, maps the bodies, hashes the tree.
  const files = await readTree(targetDir);
  if (!manifestNameIn(files, shownDir)) throw errMissingManifest(shownDir);
  const { manifest, nodeCount, migratedFromV0 } = await sealPackage(files, { where: shownDir });

  await writeTextAtomic(join(targetDir, NODES_PATH), new TextDecoder().decode(files.get(NODES_PATH)!));
  await writeTextAtomic(join(targetDir, MANIFEST_NAME), serializeManifest(manifest));
  if (migratedFromV0 && (await pathExists(join(targetDir, MANIFEST_NAME_V0)))) {
    await rm(join(targetDir, MANIFEST_NAME_V0));
  }

  const shown = relative(opts.cwd, join(targetDir, MANIFEST_NAME)) || MANIFEST_NAME;
  return { path: shown, name: manifest.name, version: manifest.version, nodeCount, migratedFromV0 };
}
