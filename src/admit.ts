/**
 * The reference import flow — the one call that composes every check, and says
 * which one refused.
 *
 * **B4, reported 2026-09-17.** The pieces all existed and none of them added up:
 * `checkCapabilities` could name a capability this reader lacks and no
 * verification refused the artifact for it; `emitKoineTree` could write a tree
 * the schema validator would reject; `verifySeal` sat beside `verifyKoineTree`,
 * which reported origin `not-established` forever regardless of whether a seal
 * travelled. A consumer wanting *may I admit this* had to assemble five answers
 * and know the order — and every assembly it got wrong would fail OPEN.
 *
 * The reviewer's rule, adopted verbatim as this module's contract: *"Nicht jede
 * einzelne Funktion muss sämtliche Aufgaben übernehmen; ihr Ergebnis darf aber
 * keinen weitergehenden Erfolg suggerieren."* Every function below still answers
 * its own question. This one answers the composed one, and nothing else claims
 * to.
 *
 * ## What `admitted: true` means, and what it does NOT
 *
 * It means: the envelope is readable, the bytes are what the package says they
 * are, this reader implements every capability the package requires, every body
 * that declares a record type satisfies it, every reference and Locator resolves,
 * no REQUIRED body is missing, and any seal that travelled verifies.
 *
 * It does **not** mean the package may be activated. Activation is the
 * application's decision and depends on facts this codec cannot see: whether the
 * publisher is trusted, whether the licence permits the use, whether the declared
 * status source says the package was withdrawn (§7.3 — fetching it is the
 * consumer's, not the format's), and whatever the domain requires on top. A
 * package can be perfectly admissible and still be one you must not install.
 */

import { checkCapabilities, type CapabilityCheck } from './capabilities.js'
import { inspectFiles, type PackageInspection } from './core/verify.js'
import { verifySeal, type SchnorrVerify, type SealVerdict } from './seal.js'
import { parseKoineTree, verifyKoineTree, KOINE_DIR } from './tree.js'
import type { KoineDsseEnvelope, KoineSealSubject } from './seal.js'
import type { KoineVerdict, KoineVerifyResult } from './types.js'

/** Which step refused. `undefined` when nothing did. */
export type AdmissionStep =
  | 'envelope'
  | 'integrity'
  | 'capabilities'
  | 'schema'
  | 'references'
  | 'completeness'
  | 'origin'

export interface AdmitOptions {
  /**
   * The capability tokens this reader implements (§8.1). **Required**, and
   * deliberately not defaulted: a default would make the must-understand rule
   * opt-in, and a rule that is opt-in is a suggestion — which is the exact defect
   * §8.1 exists to close.
   */
  readonly implements: Iterable<string>
  /** The lockfile's recorded manifest digest, when the consumer pinned one (§7.7). */
  readonly expectedIntegrity?: string
  /**
   * A seal that travelled beside the package, and the curve operation to check
   * it with. Absent means no seal was offered — origin stays `not-established`,
   * which does not refuse: the seal is additive, never a gate (§6.2).
   */
  readonly seal?: {
    readonly envelope: KoineDsseEnvelope
    readonly subject: KoineSealSubject
    readonly verify: SchnorrVerify
  }
}

export interface AdmissionVerdict {
  /** True only when every check that could run, ran and passed. */
  readonly admitted: boolean
  /** The FIRST step that refused — the one a person needs told. */
  readonly refusedAt?: AdmissionStep
  /** Every reason, from every step, so nothing is hidden behind the first. */
  readonly reasons: readonly string[]
  /** The sub-verdicts, unmodified. A caller may always look past this module. */
  readonly package: PackageInspection
  readonly tree?: KoineVerifyResult
  readonly capabilities: CapabilityCheck
  readonly origin: KoineVerdict
  /** The seal's own verdict, when one was offered. */
  readonly seal?: SealVerdict
}

const NOT_CHECKED = (why: string): KoineVerdict => ({ status: 'not-established', problems: [why] })

/**
 * Read a package and decide whether it may be admitted — integrity, then
 * capabilities, then meaning, then completeness, then origin.
 *
 * **The order is not arbitrary and is the reason this is one function.** Capability
 * refusal comes BEFORE any semantic check, because a reader that does not
 * implement a required capability must not form an opinion about the content at
 * all — its opinion would be the guess §8.1 forbids. Integrity comes first
 * because every later answer is about bytes that have to be the right bytes.
 */
export async function admitPackage(
  files: Map<string, Uint8Array>,
  options: AdmitOptions,
): Promise<AdmissionVerdict> {
  const reasons: string[] = []
  let refusedAt: AdmissionStep | undefined

  const refuse = (step: AdmissionStep, why: readonly string[]): void => {
    refusedAt ??= step
    reasons.push(...why)
  }

  // ── 1. the envelope and the bytes ──────────────────────────────────────────
  const inspection = await inspectFiles(files, {
    ...(options.expectedIntegrity === undefined ? {} : { expectedIntegrity: options.expectedIntegrity }),
  })
  if (inspection.status === 'error') {
    return {
      admitted: false,
      refusedAt: 'envelope',
      reasons: [inspection.message ?? 'the package could not be read'],
      package: inspection,
      capabilities: { honoured: false, missing: [] },
      origin: NOT_CHECKED('the package did not parse'),
    }
  }
  if (inspection.status === 'modified') {
    refuse('integrity', [
      'the package does not match its own listing',
      ...(inspection.report?.missing ?? []).map(p => `missing: ${p}`),
      ...(inspection.report?.mismatched ?? []).map(p => `changed: ${p}`),
      ...(inspection.rootMatches === false ? ['the root hash does not match the tree'] : []),
      ...(inspection.lockMatches === false ? ['the manifest does not match the lockfile pin'] : []),
    ])
  }

  // ── 2. what this reader must understand, before it understands anything ────
  const declared = [
    ...((inspection.manifest as { requires?: string[] } | undefined)?.requires ?? []),
    ...(files.has(`${KOINE_DIR}/nodes.jsonl`) ? parseKoineTree(files).requires : []),
  ]
  const capabilities = checkCapabilities([...new Set(declared)], options.implements)
  if (!capabilities.honoured) {
    refuse('capabilities', capabilities.missing.map(
      token => `this reader does not implement "${token}", which the package requires (SPEC §8.1)`,
    ))
  }

  // ── 3 & 4. the meaning layer, when the archive carried one ─────────────────
  let tree: KoineVerifyResult | undefined
  if (files.has(`${KOINE_DIR}/nodes.jsonl`)) {
    tree = await verifyKoineTree(files)
    if (tree.integrity.status === 'fail') refuse('integrity', tree.integrity.problems)
    if (tree.schema.status === 'fail') refuse('schema', tree.schema.problems)
    if (tree.references.status === 'fail') refuse('references', tree.references.problems)
  }

  // ── 5. what the package says it does not carry ─────────────────────────────
  if (inspection.status === 'incomplete') {
    refuse('completeness', (inspection.absent ?? [])
      .filter(body => body.required)
      .map(body => `the package declares "${body.path}" as required and does not carry it`))
  }

  // ── 6. who vouches — additive, never a gate, and never silently absent ─────
  let sealVerdict: SealVerdict | undefined
  let origin: KoineVerdict
  if (options.seal === undefined) {
    origin = NOT_CHECKED('no seal was offered with this package — origin is unproven, not unsound (SPEC §6.2)')
  } else {
    sealVerdict = await verifySeal(options.seal.envelope, options.seal.subject, options.seal.verify)
    if (sealVerdict.valid) {
      origin = { status: 'pass', problems: [] }
    } else {
      // A seal that was OFFERED and does not verify is a refusal. That is not in
      // tension with "additive, never a gate": the gate is on offering one at
      // all, not on it being honest once offered.
      origin = { status: 'fail', problems: [`the seal does not verify — ${sealVerdict.reason ?? 'no reason given'}`] }
      refuse('origin', origin.problems)
    }
  }

  return {
    admitted: refusedAt === undefined,
    ...(refusedAt === undefined ? {} : { refusedAt }),
    reasons,
    package: inspection,
    ...(tree === undefined ? {} : { tree }),
    capabilities,
    origin,
    ...(sealVerdict === undefined ? {} : { seal: sealVerdict }),
  }
}
