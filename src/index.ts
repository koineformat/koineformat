/**
 * `koineformat` — the reference codec for the koine form.
 *
 * One pair does the work: {@link emitKoineTree} turns bodies plus declared
 * identity into the complete file map of a koine repo (the bodies verbatim,
 * plus `.koine/*`), and {@link parseKoineTree} is its inverse.
 * {@link verifyKoineTree} recomputes every content hash and the full Merkle
 * chain — the TypeScript sibling of `tools/verify.py`, the reference verifier
 * in this repo.
 *
 * Everything below is **runtime-agnostic**: no dependency, no Node builtin, and
 * no filesystem. You hand in and receive `Map<relativePath, bytes>`, the same
 * shape a directory walk produces. The one host capability needed is WebCrypto
 * (`globalThis.crypto.subtle`) — Node 18+, Bun, Deno, browsers and Cloudflare
 * Workers all have it — which is why hashing is async throughout.
 *
 *   import { emitKoineTree, verifyKoineTree } from 'koineformat'
 *
 *   const files = await emitKoineTree({
 *     nodes: [{ id: 'n-1', path: 'notes.md', format: 'text', bytes: '# Notes\n' }],
 *   })
 *   const verdict = await verifyKoineTree(files)
 *
 * The normative definition of everything here is `SPEC.md`, shipped inside this
 * package. Where the two disagree, the SPEC is right and this is a bug.
 *
 * `sha256.ts` stays internal on purpose. The hash is normative *inside* the
 * form, not a utility this package is in the business of offering; a consumer
 * that needs its own digest — an envelope computing a root hash over the whole
 * archive, say — already has one and should keep using it.
 */

export * from './types.js'
export * from './sidecars.js'
export * from './dictionaries.js'
export * from './tree.js'
