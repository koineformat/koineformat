/**
 * `koine init` — scaffold a koine.json in a knowledge folder so the format is
 * authorable. `integrity` is left empty; `koine seal` fills it (and builds the
 * identity map). Version defaults to CalVer (YYYY.MM.0), a placeholder —
 * SPEC §7.9 leaves versioning OPEN.
 */
import { basename, join, relative, resolve } from "node:path";
import type { Manifest } from "../core/types.js";
import { SPEC_VERSION } from "../core/types.js";
import { MANIFEST_NAME, NAME_RE, serializeManifest } from "../core/manifest.js";
import { pathExists, writeTextAtomic } from "../fsx.js";
import { errBadManifest, KoineError } from "../core/errors.js";

export interface InitOptions {
  cwd: string;
  dir?: string;
  name?: string;
  force?: boolean;
}

export interface InitResult {
  path: string;
  name: string;
  version: string;
}

function calverNow(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.0`;
}

export async function init(opts: InitOptions): Promise<InitResult> {
  const targetDir = resolve(opts.cwd, opts.dir ?? ".");
  const manifestPath = join(targetDir, MANIFEST_NAME);
  const shown = relative(opts.cwd, manifestPath) || MANIFEST_NAME;

  if ((await pathExists(manifestPath)) && !opts.force) {
    throw new KoineError(
      "manifest-exists",
      `${shown} already exists.`,
      `Edit it directly, or re-run with --force to overwrite the scaffold.`,
    );
  }

  const name = opts.name ?? basename(targetDir);
  if (!NAME_RE.test(name)) {
    throw errBadManifest(`the derived name "${name}" is not valid; pass a valid --name (${NAME_RE.source})`);
  }

  const manifest: Manifest = {
    koine: SPEC_VERSION,
    name,
    version: calverNow(),
    description: "",
    license: "",
    source: { type: "git", url: "", ref: "", subpath: "." },
    provenance: { published_by: "", published_at: "", method: "none", signature: null },
    // The root hash — empty until 'koine seal' computes it; verify convicts it.
    integrity: "",
  };

  await writeTextAtomic(manifestPath, serializeManifest(manifest));
  return { path: shown, name, version: manifest.version };
}
