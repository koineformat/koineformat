/**
 * The worker-safety guarantee, made mechanical.
 *
 * The README promises this package runs unchanged on Node 18+, Bun, Deno,
 * browsers and Cloudflare Workers — and the reference implementation (NoeBase's
 * machine) holds it to that literally, importing it inside workerd, where a
 * `node:` builtin or a stray `process` is not a lint warning but a boot
 * failure. A promise in prose drifts;
 * this suite walks the REAL import graph from the library entry and refuses
 * anything the smallest of those runtimes does not have.
 *
 * It should pass trivially — the codec is pure, its only host capability is
 * WebCrypto. Passing trivially is the point: the day someone reaches for
 * `node:crypto` to make a test easier, this is what says no.
 *
 * `test/lib.test.ts` beside it holds the envelope half to the same guarantee —
 * one standard, one guarantee, one mechanism.
 */
import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative, resolve } from 'node:path'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Drop comments, so a usage example inside a doc block is not mistaken for a
 * real import. `(?<!:)` keeps `https://…` inside string literals intact.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(?<!:)\/\/.*$/gm, '')
}

/**
 * Every module specifier a file imports or re-exports from.
 *
 * The `(?<!["'])` on each keyword is load-bearing here in a way it is not in
 * the pin sibling: this codec parses a field literally named `from`, so
 * `requireString(file, i, row, 'from')` ends a string one character before the
 * keyword and the naive pattern reads the rest of the line as a specifier. A
 * keyword that opens an import is never itself preceded by a quote.
 */
function specifiersOf(file: string): string[] {
  const source = stripComments(readFileSync(file, 'utf8'))
  const out: string[] = []
  const patterns = [
    /(?<!["'])\bfrom\s*["']([^"']+)["']/g, // import … from "x" · export … from "x"
    /(?<!["'])\bimport\s*\(\s*["']([^"']+)["']\s*\)/g, // dynamic import("x")
    /^\s*import\s+["']([^"']+)["']/gm, // bare side-effect import "x"
    /(?<!["'])\brequire\s*\(\s*["']([^"']+)["']\s*\)/g, // createRequire escape hatch
  ]
  for (const re of patterns) {
    for (const m of source.matchAll(re)) out.push(m[1] as string)
  }
  return out
}

/** Walk the import graph from `entry`. `toFile` maps a specifier to a real file. */
function walk(entry: string, toFile: (from: string, spec: string) => string): {
  readonly files: readonly string[]
  readonly externals: ReadonlyMap<string, readonly string[]>
} {
  const externals = new Map<string, string[]>() // specifier → importing files
  const seen = new Set<string>()
  const queue = [entry]

  while (queue.length > 0) {
    const file = queue.pop() as string
    if (seen.has(file)) continue
    seen.add(file)

    for (const spec of specifiersOf(file)) {
      if (spec.startsWith('.')) {
        queue.push(toFile(file, spec))
        continue
      }
      const importers = externals.get(spec) ?? []
      importers.push(relative(ROOT, file))
      externals.set(spec, importers)
    }
  }
  return { files: [...seen], externals }
}

const fromSource = (from: string, spec: string): string => join(dirname(from), spec.replace(/\.js$/, '.ts'))
const fromBuilt = (from: string, spec: string): string => join(dirname(from), spec)

/**
 * Globals that do not exist in a Worker, or that only exist under CommonJS.
 * A hit here means the module assumed a Node host without saying so.
 */
const FORBIDDEN_GLOBALS = ['process', 'Buffer', '__dirname', '__filename', 'require', 'module', 'global']

/** Everything the codec is allowed to reach for. Every one of these is in workerd. */
const ALLOWED_GLOBALS = [
  'JSON', 'globalThis', 'crypto', 'Promise', 'Uint8Array', 'TextEncoder', 'TextDecoder',
  'Map', 'Set', 'Error', 'Object', 'Array', 'Number', 'String', 'Boolean', 'Math', 'RegExp', 'Symbol',
]

/** Strip comments AND string literals — a forbidden name is only a hit as code. */
function codeOnly(source: string): string {
  return stripComments(source)
    .replace(/`(?:[^`\\]|\\.)*`/g, '``')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
}

describe('worker-safe by construction', () => {
  it('reaches nothing outside itself from src/index.ts — no builtin, no dependency', () => {
    const { externals } = walk(join(ROOT, 'src/index.ts'), fromSource)
    expect([...externals.keys()]).toEqual([])
  })

  it('reaches every module of the codec, so the walk above is not vacuous', () => {
    const { files } = walk(join(ROOT, 'src/index.ts'), fromSource)
    expect(files.map((f) => relative(ROOT, f)).sort()).toEqual([
      'src/dictionaries.ts',
      'src/index.ts',
      'src/sha256.ts',
      'src/sidecars.ts',
      'src/tree.ts',
      'src/types.ts',
    ])
  })

  it('names no Node-only global anywhere on that graph', () => {
    const { files } = walk(join(ROOT, 'src/index.ts'), fromSource)
    const hits: string[] = []
    for (const file of files) {
      const source = codeOnly(readFileSync(file, 'utf8'))
      for (const name of FORBIDDEN_GLOBALS) {
        if (new RegExp(`\\b${name}\\b`).test(source)) hits.push(`${relative(ROOT, file)}: ${name}`)
      }
    }
    expect(hits).toEqual([])
  })

  it('needs exactly one host capability — WebCrypto, and only in the hash module', () => {
    const { files } = walk(join(ROOT, 'src/index.ts'), fromSource)
    const usingCrypto = files
      .filter((file) => /\bcrypto\.subtle\b/.test(codeOnly(readFileSync(file, 'utf8'))))
      .map((file) => relative(ROOT, file))
    expect(usingCrypto).toEqual(['src/sha256.ts'])
    // …and `crypto` is on the allow-list, which is what makes that acceptable.
    expect(ALLOWED_GLOBALS).toContain('crypto')
  })

  it('holds for the built dist/index.js graph too', () => {
    const entry = join(ROOT, 'dist/index.js')
    if (!existsSync(entry)) return // not built yet — CI builds before it tests
    const { externals, files } = walk(entry, fromBuilt)
    expect([...externals.keys()]).toEqual([])
    for (const file of files) {
      const source = codeOnly(readFileSync(file, 'utf8'))
      for (const name of FORBIDDEN_GLOBALS) {
        expect(new RegExp(`\\b${name}\\b`).test(source)).toBe(false)
      }
    }
  })
})
