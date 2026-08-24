/**
 * Typed errors — the U6 invariant: every failure names its cause *and* its fix.
 * A `KoineError` carries a stable machine `code`, a human `message`, and an
 * actionable `fix`. The CLI shell (bin) prints `error: <message>` + `→ <fix>`
 * and exits non-zero. Stack traces never reach users.
 */
export class KoineError extends Error {
  readonly code: string;
  readonly fix: string;

  constructor(code: string, message: string, fix: string) {
    super(message);
    this.name = "KoineError";
    this.code = code;
    this.fix = fix;
  }
}

/** True for the errors we render cleanly; anything else is an unexpected bug. */
export function isKoineError(e: unknown): e is KoineError {
  return e instanceof KoineError;
}

// ── Source / resolution ────────────────────────────────────────────────────
export const errUnknownSource = (src: string): KoineError =>
  new KoineError(
    "unknown-source",
    `Don't know how to resolve the source "${src}".`,
    `Use github:owner/repo[/sub/path][#ref] or path:../local/folder. ` +
      `git+https and https tarball sources are not supported in v0.`,
  );

export const errRefNotFound = (ref: string, url: string): KoineError =>
  new KoineError(
    "ref-not-found",
    `Could not resolve ref "${ref}" in ${url}.`,
    `Check the branch, tag, or commit exists and is spelled correctly.`,
  );

export const errNetwork = (url: string, detail: string): KoineError =>
  new KoineError(
    "network",
    `Network request failed: ${url} (${detail}).`,
    `Check your connection. 'koine verify' and 'koine list' work fully offline.`,
  );

// ── Manifest / integrity ───────────────────────────────────────────────────
export const errMissingManifest = (where: string): KoineError =>
  new KoineError(
    "missing-manifest",
    `No koine.json (or v0 pin.json) found in ${where}.`,
    `A package must have a koine.json at its root. Run 'koine init' to scaffold one.`,
  );

export const errBadManifest = (detail: string): KoineError =>
  new KoineError(
    "bad-manifest",
    `The manifest is invalid: ${detail}.`,
    `Fix the manifest (see SPEC §7.3), then re-run.`,
  );

export const errRootMismatch = (where: string): KoineError =>
  new KoineError(
    "root-mismatch",
    `The root hash in ${where} does not match its tree — the archive was altered after sealing.`,
    `Re-fetch from the source; if it persists, ask the publisher to re-seal ('koine seal').`,
  );

export const errAmbiguousEnvelope = (where: string): KoineError =>
  new KoineError(
    "ambiguous-envelope",
    `${where} carries BOTH koine.json and pin.json — the envelope is ambiguous (SPEC §7.11).`,
    `Keep koine.json and delete pin.json ('koine seal' migrates a v0 package in place).`,
  );

export const errBadLockfile = (detail: string): KoineError =>
  new KoineError(
    "bad-lockfile",
    `The lockfile is invalid: ${detail}.`,
    `Fix or delete it, then run 'koine install' to rebuild from your sources.`,
  );

export const errUnsupportedSpec = (found: string): KoineError =>
  new KoineError(
    "unsupported-spec",
    `This package targets spec version "${found}", which this CLI does not understand.`,
    `Upgrade the CLI, or ask the publisher for a version-0 package.`,
  );

export const errIntegrityMismatch = (path: string, tamper: boolean): KoineError =>
  new KoineError(
    "integrity-mismatch",
    `Integrity check failed for ${path}: on-disk bytes do not match the recorded hash.`,
    tamper
      ? `The file may have been tampered with in transit. Do not use it; report to the publisher.`
      : `Ask the publisher to re-seal the package ('koine seal'), then re-fetch.`,
  );

export const errUnlistedFile = (path: string): KoineError =>
  new KoineError(
    "unlisted-file",
    `File present on disk but absent from the manifest: ${path}.`,
    `Possible tampering, or the publisher forgot to re-seal. Review the diff.`,
  );

// ── Vendoring / consumer state ─────────────────────────────────────────────
export const errLocalEdits = (name: string, files: readonly string[]): KoineError =>
  new KoineError(
    "local-edits",
    `Refusing to update "${name}": these vendored files have local edits — ` +
      files.slice(0, 5).join(", ") + (files.length > 5 ? `, …` : ``) + `.`,
    `Commit or revert your edits first, or re-run with --force to overwrite them.`,
  );

export const errNotInstalled = (name: string): KoineError =>
  new KoineError(
    "not-installed",
    `No package named "${name}" is installed.`,
    `Run 'koine list' to see installed packages, or 'koine add <source>' to add one.`,
  );

export const errAlreadyExists = (dir: string): KoineError =>
  new KoineError(
    "already-exists",
    `Target directory ${dir} already exists and is not tracked by the lockfile.`,
    `Choose another name with --as <dir>, or remove the directory first.`,
  );

// ── Safety (U4) ────────────────────────────────────────────────────────────
export const errPathTraversal = (path: string): KoineError =>
  new KoineError(
    "path-traversal",
    `Package entry escapes its root: ${JSON.stringify(path)}.`,
    `This is a traversal attempt ("..", absolute, or drive path). Refusing to extract.`,
  );

export const errUnsafeEntry = (path: string, kind: string): KoineError =>
  new KoineError(
    "unsafe-entry",
    `Package contains a ${kind}: ${JSON.stringify(path)}.`,
    `Pin v0 packages may contain regular files only — no symlinks or special files.`,
  );

export const errBadArchive = (detail: string): KoineError =>
  new KoineError(
    "bad-archive",
    `The downloaded archive is not readable: ${detail}.`,
    `The source may be corrupt or truncated. Try again; if it persists, report it to the publisher.`,
  );

export const errTooLarge = (detail: string): KoineError =>
  new KoineError(
    "too-large",
    `Package exceeds a safety limit: ${detail}.`,
    `Refusing to extract an implausibly large package. Split it or raise the limit deliberately.`,
  );

// ── Environment ────────────────────────────────────────────────────────────
export const errNoWebCrypto = (): KoineError =>
  new KoineError(
    "no-webcrypto",
    `This runtime has no WebCrypto (globalThis.crypto.subtle), so integrity digests cannot be computed.`,
    `Use Node 18+, Bun, Deno, or a browser/worker runtime. Integrity is not optional in Pin.`,
  );
