/**
 * Koine codec — record-type validation (SPEC §2.2, §5 receipt step 3).
 *
 * The form's second verify question — *does this body hold what its declared
 * record type says it holds* — had no implementation at all: `verifyKoineTree`
 * recomputed hashes and the chain and never opened a body against the
 * dictionary the tree itself carries. Integrity without schema is a verdict
 * that a file is unaltered and possibly meaningless.
 *
 * **A declared subset, on purpose.** This package has no runtime dependency and
 * that is load-bearing — the reference verifier in `tools/verify.py` runs on a
 * bare interpreter, and a standard whose conformance needs a 200 kB validator
 * has a different adoption curve than one whose conformance needs fifty lines.
 * So this implements the JSON Schema keywords a record type actually uses, and
 * SPEC §2.2 names them. An unknown keyword is IGNORED, which is JSON Schema's
 * own rule and chapter 8's — never a failure.
 *
 * Not supported, and declared rather than silently absent: `$ref` and every
 * form of schema reuse, `dependentSchemas`, `dependentRequired`,
 * `patternProperties`, `propertyNames`, `unevaluated*`, and `format` as an
 * assertion (it is annotation-only, per JSON Schema's own default).
 */

/** The JSON Schema keywords this validator asserts on. SPEC §2.2 cites this list. */
export const SUPPORTED_KEYWORDS = [
  'type',
  'const',
  'enum',
  'required',
  'properties',
  'additionalProperties',
  'items',
  'minItems',
  'maxItems',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'minLength',
  'maxLength',
  'pattern',
  'anyOf',
  'oneOf',
  'allOf',
  'not',
  'if',
  'then',
  'else',
] as const

type Json = Record<string, unknown>

const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v)

function typeOf(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number'
  return typeof value
}

function typeMatches(declared: string, actual: string): boolean {
  if (declared === actual) return true
  // An integer is a number; a whole-valued number is an integer (JSON Schema 2020-12).
  return declared === 'number' && actual === 'integer'
}

/**
 * Canonical JSON: recursively sorted object keys, arrays left in order.
 *
 * **It builds a STRING, never an object, and that is the whole point.** The
 * obvious implementation accumulates into a `{}` and hands it to
 * `JSON.stringify` — and a JavaScript object is not a JSON object. Assigning
 * `out["__proto__"]` sets the prototype instead of creating an own property, so
 * a perfectly legal JSON key named `__proto__` VANISHES before the digest is
 * taken. Two different manifests then produce the same digest and a real
 * signature stays valid across a real change (B9, reported 2026-09-17).
 *
 * `Object.create(null)` would fix that one key. Serializing directly fixes the
 * class: there is no object model between the data and the bytes, so there is
 * nothing for the language to reinterpret. A canonicalization whose correctness
 * depends on which key names the host treats as special is not canonical.
 *
 * `undefined` members are dropped — as `JSON.stringify` drops them — so the
 * projection matches what a round trip through JSON would hold.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) {
    return `[${value.map(v => (v === undefined ? 'null' : canonicalJson(v))).join(',')}]`
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`
}

/**
 * Value equality that ignores object key ORDER and distinguishes ABSENCE from
 * `null` — see {@link canonicalJson}.
 *
 * **The presence test comes first, and B14 is why.** `canonicalJson(undefined)`
 * is `"null"` — it must be, because that is what `JSON.stringify` does inside an
 * array — so an equality built on the string alone made a missing field equal to
 * a `null` one. The proposal contract distinguishes them explicitly (an omitted
 * `from` means the field was absent; `null` is the JSON value null), so a
 * proposal ADDING a field as `null` was read as changing nothing and refused as
 * internally inconsistent.
 *
 * Absence is not a value. It is answered before values are compared at all.
 */
export const deepEqual = (a: unknown, b: unknown): boolean =>
  (a === undefined) === (b === undefined) && canonicalJson(a) === canonicalJson(b)

/**
 * Validate a value against a record type's schema. Returns every problem found,
 * each naming the JSON Pointer of the offending location, so a caller can point
 * at a field rather than at a file.
 */
export function validateAgainstSchema(value: unknown, schema: unknown, at = ''): string[] {
  const where = at === '' ? 'the body' : `"${at}"`
  // **A BOOLEAN IS A SCHEMA** (JSON Schema core, "Boolean JSON Schemas"): `true` admits every
  // value, `false` admits none. Treating a non-object schema as "nothing to
  // check" — which this did until 0.7.0 — inverts three keywords at once:
  // `{"not": false}` rejected everything (its subschema "passed"),
  // `{"properties": {"x": false}}` admitted the forbidden value, and
  // `{"items": false}` admitted every array. Reported as B6.
  if (schema === true) return []
  if (schema === false) return [`${where} is present, and the record type admits no value here`]
  if (!isObject(schema)) return []
  const problems: string[] = []

  const type = schema['type']
  if (typeof type === 'string' || Array.isArray(type)) {
    const declared = (Array.isArray(type) ? type : [type]).filter((t): t is string => typeof t === 'string')
    const actual = typeOf(value)
    if (declared.length > 0 && !declared.some((d) => typeMatches(d, actual))) {
      problems.push(`${where} is ${actual}, and the record type declares ${declared.join(' | ')}`)
      return problems // a wrong type makes every other keyword's verdict noise
    }
  }

  if (Object.hasOwn(schema, 'const') && !deepEqual(value, schema['const'])) {
    problems.push(`${where} must be ${JSON.stringify(schema['const'])}`)
  }

  const enumeration = schema['enum']
  if (Array.isArray(enumeration) && !enumeration.some((option) => deepEqual(value, option))) {
    problems.push(`${where} is not one of ${JSON.stringify(enumeration)}`)
  }

  if (typeof value === 'string') {
    const min = schema['minLength']
    const max = schema['maxLength']
    const length = [...value].length
    if (typeof min === 'number' && length < min) problems.push(`${where} is shorter than ${min}`)
    if (typeof max === 'number' && length > max) problems.push(`${where} is longer than ${max}`)
    const pattern = schema['pattern']
    if (typeof pattern === 'string') {
      let re: RegExp | undefined
      try {
        re = new RegExp(pattern)
      } catch {
        // An unparseable pattern is the schema author's defect, not the body's.
      }
      if (re !== undefined && !re.test(value)) problems.push(`${where} does not match /${pattern}/`)
    }
  }

  if (typeof value === 'number') {
    const min = schema['minimum']
    const max = schema['maximum']
    const exMin = schema['exclusiveMinimum']
    const exMax = schema['exclusiveMaximum']
    if (typeof min === 'number' && value < min) problems.push(`${where} is below the minimum ${min}`)
    if (typeof max === 'number' && value > max) problems.push(`${where} is above the maximum ${max}`)
    if (typeof exMin === 'number' && value <= exMin) problems.push(`${where} must exceed ${exMin}`)
    if (typeof exMax === 'number' && value >= exMax) problems.push(`${where} must be under ${exMax}`)
  }

  if (Array.isArray(value)) {
    const min = schema['minItems']
    const max = schema['maxItems']
    if (typeof min === 'number' && value.length < min) problems.push(`${where} has fewer than ${min} items`)
    if (typeof max === 'number' && value.length > max) problems.push(`${where} has more than ${max} items`)
    const items = schema['items']
    if (isObject(items) || typeof items === 'boolean') {
      value.forEach((item, i) => problems.push(...validateAgainstSchema(item, items, `${at}/${i}`)))
    }
  }

  if (isObject(value)) {
    const required = schema['required']
    if (Array.isArray(required)) {
      for (const key of required) {
        if (typeof key === 'string' && !Object.hasOwn(value, key)) {
          problems.push(`${where} is missing the required field "${key}"`)
        }
      }
    }
    const properties = schema['properties']
    if (isObject(properties)) {
      for (const [key, sub] of Object.entries(properties)) {
        if (Object.hasOwn(value, key)) {
          problems.push(...validateAgainstSchema(value[key], sub, `${at}/${key}`))
        }
      }
    }
    if (schema['additionalProperties'] === false) {
      const declared = isObject(properties) ? new Set(Object.keys(properties)) : new Set<string>()
      for (const key of Object.keys(value)) {
        if (!declared.has(key)) problems.push(`${where} carries "${key}", which the record type does not declare`)
      }
    }
  }

  const allOf = schema['allOf']
  if (Array.isArray(allOf)) {
    for (const sub of allOf) problems.push(...validateAgainstSchema(value, sub, at))
  }
  const anyOf = schema['anyOf']
  if (Array.isArray(anyOf) && anyOf.length > 0) {
    if (!anyOf.some((sub) => validateAgainstSchema(value, sub, at).length === 0)) {
      problems.push(`${where} matches none of the ${anyOf.length} alternatives the record type allows`)
    }
  }
  const oneOf = schema['oneOf']
  if (Array.isArray(oneOf) && oneOf.length > 0) {
    const matches = oneOf.filter((sub) => validateAgainstSchema(value, sub, at).length === 0).length
    if (matches !== 1) {
      problems.push(`${where} matches ${matches} of the ${oneOf.length} alternatives, and exactly one is allowed`)
    }
  }
  if (Object.hasOwn(schema, 'not') && validateAgainstSchema(value, schema['not'], at).length === 0) {
    problems.push(`${where} matches a shape the record type excludes`)
  }

  // `if`/`then`/`else` — the keyword this standard's own worked example turns
  // on. `metric-definition` says a `unit: rate` MUST carry a denominator, and
  // the example's README promises that absence is *mechanically detectable*; a
  // validator that ignored the keyword would make that sentence false.
  if (Object.hasOwn(schema, 'if')) {
    const branch = validateAgainstSchema(value, schema['if'], at).length === 0 ? schema['then'] : schema['else']
    if (branch !== undefined) problems.push(...validateAgainstSchema(value, branch, at))
  }

  return problems
}

/**
 * Coerce a shape block's declared values to the types its record type declares.
 *
 * A shape block is a TEXT serialization of a typed record (§2.2): every value
 * arrives as a string. Without this step a record type with any non-string
 * field is unexpressible in a shape block at all, and §2.2's *"MUST validate
 * against it"* would be unsatisfiable rather than strict.
 *
 * A value that cannot be coerced is left as the string it is, so the validator
 * reports the real mismatch against the real field instead of a parse error
 * with no field name on it.
 */
export function coerceShapeValues(
  declarations: ReadonlyMap<string, string>,
  schema: unknown,
): Record<string, unknown> {
  const properties = isObject(schema) && isObject(schema['properties']) ? (schema['properties'] as Json) : {}
  const shape: Record<string, unknown> = {}
  for (const [key, raw] of declarations) {
    const declared = properties[key]
    const type = isObject(declared) ? declared['type'] : undefined
    const first = Array.isArray(type) ? type[0] : type
    shape[key] = coerce(raw, typeof first === 'string' ? first : undefined)
  }
  return shape
}

function coerce(raw: string, type: string | undefined): unknown {
  switch (type) {
    case 'integer':
    case 'number': {
      if (raw.trim() === '') return raw
      const n = Number(raw)
      return Number.isFinite(n) ? n : raw
    }
    case 'boolean':
      if (raw === 'true') return true
      if (raw === 'false') return false
      return raw
    case 'null':
      return raw === 'null' ? null : raw
    case 'array':
    case 'object':
      try {
        const parsed: unknown = JSON.parse(raw)
        return typeOf(parsed) === type ? parsed : raw
      } catch {
        return raw
      }
    default:
      return raw
  }
}
