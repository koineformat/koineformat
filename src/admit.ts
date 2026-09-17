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
import { deepEqual } from './schema.js'
import { inspectFiles, type PackageInspection } from './core/verify.js'
import { manifestPapers, packageSubject, verifySeal, type SchnorrVerify, type SealVerdict } from './seal.js'
import { parseKoineTree, verifyKoineTree, KOINE_DIR } from './tree.js'
import type { KoineDsseEnvelope, KoineSealSubject } from './seal.js'
import type { KoineContentHash, KoineVerdict, KoineVerifyResult } from './types.js'

/**
 * The steps, IN ORDER — one declaration that the flow and `notRun` both read.
 *
 * Two lists would be two truths: the sequence would drift from the set a verdict
 * reports as skipped, and nothing would notice. `notRun` is derived from this by
 * subtraction, so a step that is added and forgotten shows up as permanently
 * not-run rather than as silently absent.
 */
export const ADMISSION_STEPS = [
  'envelope',
  'integrity',
  'capabilities',
  'schema',
  'references',
  'completeness',
  'identity',
  'origin',
] as const

/** Which step refused. `undefined` when nothing did. */
export type AdmissionStep = (typeof ADMISSION_STEPS)[number]

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
   *
   * **There is no `subject` field, and its absence is the fix for B8.** This
   * used to take one from the caller and never connect it to the package it had
   * just read, so `admitPackage(filesB, { seal: sealOfA, subject: subjectOfA })`
   * returned `admitted: true` with a genuine signature over a different package.
   * The subject is now DERIVED from the manifest this function read — which is
   * the rule `verifySeal`'s own docblock states and this function broke one
   * layer up: *a verifier that took the subject from the seal would be checking
   * the seal against itself.* Taking it from the caller is the same error with a
   * longer path.
   *
   * An API that cannot express the mistake needs no test against it; the
   * negative vector below exists anyway, because the shape recurs.
   */
  readonly seal?: {
    readonly envelope: KoineDsseEnvelope
    readonly verify: SchnorrVerify
  }
  /**
   * OPTIONAL, and never a substitute for derivation: what the caller expected
   * the package subject to be. When given it is compared against the derived
   * one, so a consumer holding a pinned expectation learns that the package
   * moved — a different guarantee from the signature's, and worth having beside
   * it.
   */
  readonly expectedSubject?: KoineSealSubject
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
  /**
   * Steps that did NOT run, because an earlier one refused and running them
   * would have produced an opinion the reader was not entitled to.
   *
   * Present only when something was skipped. It exists so that no caller infers
   * a pass from an absence: a verdict that simply omitted the later steps would
   * read, at every call site, exactly like one where they passed.
   */
  readonly notRun?: readonly AdmissionStep[]
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
  const ran: AdmissionStep[] = []
  let refusedAt: AdmissionStep | undefined

  let inspection: PackageInspection = { status: 'error' }
  let capabilities: CapabilityCheck = { honoured: false, missing: [] }
  let tree: KoineVerifyResult | undefined
  let sealVerdict: SealVerdict | undefined
  let origin: KoineVerdict = NOT_CHECKED('nothing was checked')

  const refuse = (step: AdmissionStep, why: readonly string[]): void => {
    refusedAt ??= step
    reasons.push(...why)
  }

  /**
   * One exit, and `notRun` derived from what actually ran rather than listed by
   * hand.
   *
   * **B15.** The STOP rule was written into §7.15 and implemented at exactly one
   * of the steps, so an integrity or schema refusal went on to check origin —
   * and the one early return HARDCODED `refusedAt: 'capabilities'`, overwriting
   * the earlier refusal it was supposed to preserve. A rule applied at the site
   * that was reported is not a rule; this shape makes the omission unwritable,
   * because a step that does not run cannot be added to `ran`.
   */
  const finish = (): AdmissionVerdict => {
    const notRun = ADMISSION_STEPS.filter((step: AdmissionStep) => !ran.includes(step))
    return {
      admitted: refusedAt === undefined,
      ...(refusedAt === undefined ? {} : { refusedAt }),
      reasons,
      ...(notRun.length > 0 ? { notRun } : {}),
      package: inspection,
      ...(tree === undefined ? {} : { tree }),
      capabilities,
      origin,
      ...(sealVerdict === undefined ? {} : { seal: sealVerdict }),
    }
  }

  // ── 1. the envelope and the bytes ──────────────────────────────────────────
  inspection = await inspectFiles(files, {
    ...(options.expectedIntegrity === undefined ? {} : { expectedIntegrity: options.expectedIntegrity }),
  })
  ran.push('envelope')
  if (inspection.status === 'error') {
    refuse('envelope', [inspection.message ?? 'the package could not be read'])
    origin = NOT_CHECKED('the package did not parse')
    return finish()
  }

  // A malformed sidecar is a verdict, not an exception: a thrown parse error has
  // no step and no reasons, and every catch site invents a meaning for it.
  const hasTree = files.has(`${KOINE_DIR}/nodes.jsonl`)
  let treeRequires: readonly string[] = []
  if (hasTree) {
    try {
      treeRequires = parseKoineTree(files).requires
    } catch (error) {
      refuse('envelope', [`the koine tree does not parse — ${error instanceof Error ? error.message : String(error)}`])
      origin = NOT_CHECKED('the tree did not parse')
      return finish()
    }
  }

  ran.push('integrity')
  if (inspection.status === 'modified') {
    refuse('integrity', [
      'the package does not match its own listing',
      ...(inspection.report?.missing ?? []).map(p => `missing: ${p}`),
      ...(inspection.report?.mismatched ?? []).map(p => `changed: ${p}`),
      ...(inspection.rootMatches === false ? ['the root hash does not match the tree'] : []),
      ...(inspection.lockMatches === false ? ['the manifest does not match the lockfile pin'] : []),
    ])
    origin = NOT_CHECKED('the bytes are not what the package says they are, so nothing downstream was checked')
    return finish()
  }

  // ── 2. what this reader must understand, before it understands anything ────
  const declared = [
    ...((inspection.manifest as { requires?: string[] } | undefined)?.requires ?? []),
    ...treeRequires,
  ]
  capabilities = checkCapabilities([...new Set(declared)], options.implements)
  ran.push('capabilities')
  if (!capabilities.honoured) {
    refuse('capabilities', capabilities.missing.map(
      token => `this reader does not implement "${token}", which the package requires (SPEC §8.1)`,
    ))
    origin = NOT_CHECKED('the reader lacks a required capability, so nothing downstream was checked')
    return finish()
  }

  // ── 3 & 4. the meaning layer, when the archive carried one ─────────────────
  if (hasTree) tree = await verifyKoineTree(files)
  ran.push('schema')
  if (tree?.schema.status === 'fail') {
    refuse('schema', tree.schema.problems)
    origin = NOT_CHECKED('the bodies do not satisfy their declared types, so nothing downstream was checked')
    return finish()
  }
  ran.push('references')
  if (tree?.integrity.status === 'fail' || tree?.references.status === 'fail') {
    refuse('references', [...tree.integrity.problems, ...tree.references.problems])
    origin = NOT_CHECKED('the tree names something it does not hold, so nothing downstream was checked')
    return finish()
  }

  // ── 5. what the package says it does not carry ─────────────────────────────
  ran.push('completeness')
  if (inspection.status === 'incomplete') {
    refuse('completeness', (inspection.absent ?? [])
      .filter(body => body.required)
      .map(body => `the package declares "${body.path}" as required and does not carry it`))
    origin = NOT_CHECKED('a required body is missing, so origin was not checked')
    return finish()
  }

  // ── 6. is this the package the caller expected ─────────────────────────────
  //
  // **B13.** `expectedSubject` was only compared inside the seal branch, so a
  // caller that pinned an expectation and offered no seal had it silently
  // ignored — the option contract promised a comparison and the code delivered
  // one only in company. It is its own step because it is its own question:
  // identity is WHICH package this is, and needs nobody to have vouched for it.
  const manifest = inspection.manifest as unknown as Record<string, unknown> | undefined
  const derived = manifest === undefined
    ? undefined
    : packageSubject(
        manifest['name'] as string,
        manifest['version'] as string,
        manifest['integrity'] as KoineContentHash,
        await manifestPapers(manifest),
      )
  ran.push('identity')
  if (options.expectedSubject !== undefined) {
    if (derived === undefined || !deepEqual(options.expectedSubject, derived)) {
      refuse('identity', ['the package is not the one the caller expected'])
      origin = NOT_CHECKED('the package is not the expected one, so origin was not checked')
      return finish()
    }
  }

  // ── 7. who vouches — additive, never a gate, and never silently absent ─────
  ran.push('origin')
  if (options.seal === undefined) {
    origin = NOT_CHECKED('no seal was offered with this package — origin is unproven, not unsound (SPEC §6.2)')
  } else if (derived === undefined) {
    origin = NOT_CHECKED('the manifest did not read, so no subject could be derived to check the seal against')
  } else {
    // DERIVED, never accepted (§6.3): the subject is what THIS package is.
    sealVerdict = await verifySeal(options.seal.envelope, derived, options.seal.verify)
    if (sealVerdict.valid) {
      origin = { status: 'pass', problems: [] }
    } else {
      // A seal that was OFFERED and does not verify is a refusal. The gate is on
      // offering one at all, not on it being honest once offered.
      origin = { status: 'fail', problems: [`the seal does not verify — ${sealVerdict.reason ?? 'no reason given'}`] }
      refuse('origin', origin.problems)
    }
  }

  return finish()
}
