/**
 * Shared, dependency-free parsing helpers for the Trope Graph validators.
 *
 * The validators parse the seed files as TEXT and never import or execute them. That is a
 * deliberate constraint: a malformed or hostile seed must not be able to run code during
 * validation, and the validators need to run without `tsx` or a build step.
 *
 * The trade-off is that these helpers understand the shape of the seed source rather than
 * its meaning. Every helper therefore fails loudly on a shape change instead of silently
 * returning an empty result, which is what let the archived validators rot: they read a
 * `claim-decomposition.json` export that no longer existed and reported nothing at all.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** Absolute path of the `trope-cards` root. */
export const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
)

/**
 * Read a file relative to the `trope-cards` root.
 *
 * @param {string} relative
 * @returns {string}
 */
export function readSeed(relative) {
  return readFileSync(path.join(ROOT, relative), 'utf8')
}

/**
 * Extract the leading string of every `[ "slug", ... ]` tuple in a named seed array.
 *
 * @param {string} source
 * @param {string} name Name of the exported constant, e.g. "mechanismsSeed".
 * @returns {string[]}
 * @throws {Error} If the constant is not found, rather than returning an empty list.
 */
export function tupleSlugs(source, name) {
  const match = source.match(
    new RegExp(`${name}\\s*(?::[^=]+)?=\\s*\\[([\\s\\S]*?)\\]\\s*as const`),
  )
  if (!match) {
    throw new Error(
      `Could not find exported constant "${name}". Update the validator.`,
    )
  }
  return [...match[1].matchAll(/\[\s*['"]([^'"]+)['"]/g)].map((m) => m[1])
}

/**
 * Locate the opening bracket of an array, given a dotted path.
 *
 * Handles both a top-level constant (`draftCards = [`) and a property of one
 * (`claimDecompositionSeed.inferenceSteps: [`).
 *
 * @param {string} source
 * @param {string} path Dotted path to the array.
 * @returns {{ open: number, close: number }} Bracket indices.
 * @throws {Error} If the array is not found, so a shape change is loud.
 */
function findArray(source, path) {
  const segments = path.split('.')
  const name = segments[segments.length - 1]
  // Top-level constants are assigned; nested properties are keyed.
  const pattern =
    segments.length === 1
      ? `${name}\\s*(?::[^=\\n]+)?=\\s*\\[`
      : `${name}\\s*:\\s*\\[`
  const match = source.match(new RegExp(pattern))
  if (!match?.[0]) {
    throw new Error(`Could not find array "${path}". Update the validator.`)
  }
  const open = source.indexOf(match[0]) + match[0].length - 1
  return { open, close: matchBracket(source, open) }
}

/**
 * Extract the object literals of a nested array field, e.g. `chains[].steps[]`.
 *
 * `parseFields` can only flatten an array of strings, so an array of objects needs its own
 * pass. The outer array is located by `arrayPath`, the nested one by `field` within it.
 *
 * @param {string} source
 * @param {string} arrayPath Dotted path of the outer array.
 * @param {string} field Name of the nested array field.
 * @param {string} key Field that must be the nested object's first field.
 * @returns {Array<Record<string, string | string[]>>}
 */
export function extractNestedObjects(source, arrayPath, field, key) {
  const { open, close } = findArray(source, arrayPath)
  const body = source.slice(open, close)
  const fieldMatch = body.match(new RegExp(`${field}\\s*:\\s*\\[`))
  if (!fieldMatch?.[0]) return []

  const fieldOpen = body.indexOf(fieldMatch[0]) + fieldMatch[0].length - 1
  const fieldClose = matchBracket(body, fieldOpen)
  const anchor = new RegExp(`^\\{\\s*${key}\\s*:`)
  const results = []

  for (let i = fieldOpen; i < fieldClose; i += 1) {
    if (body[i] !== '{') continue
    const found = readObject(body, i)
    if (!found || found.end > fieldClose) break
    if (!anchor.test(found.text)) continue
    const fields = parseFields(found)
    if (fields[key] !== undefined) results.push(fields)
    i = found.end
  }
  return results
}

/**
 * Extract every object literal in an array addressed by a dotted path.
 *
 * Brace matching ignores braces inside string literals, so a `summary` containing an
 * apostrophe or a brace cannot desynchronise the scan.
 *
 * `key` is the field that must appear first in each object. It disambiguates arrays whose
 * members are not all alike: cards open with `slug`, while claims and inference steps open
 * with `cardSlug` and also carry a `slug` of their own. Without this, extracting claims
 * would also return the cards that happen to precede them in the file.
 *
 * @param {string} source
 * @param {string} path Dotted path, e.g. "draftCards" or
 *   "claimDecompositionSeed.inferenceSteps".
 * @param {string} key Field that must be the object's first field. Defaults to "slug".
 * @returns {Array<Record<string, string | string[]>>} Field name to value.
 * @throws {Error} If the array is not found.
 */
export function extractObjects(source, path, key = 'slug') {
  const { open: arrayStart, close: arrayEnd } = findArray(source, path)
  const anchor = new RegExp(`^\\{\\s*${key}\\s*:`)
  const results = []

  for (let i = arrayStart; i < arrayEnd; i += 1) {
    if (source[i] !== '{') continue
    const body = readObject(source, i)
    if (!body || body.end > arrayEnd) break
    if (!anchor.test(body.text)) continue
    const fields = parseFields(body)
    if (fields[key] !== undefined) results.push(fields)
    i = body.end
  }
  return results
}

/**
 * Find the bracket that closes the one at `start`, honouring string literals.
 *
 * @param {string} source
 * @param {number} start Index of the opening bracket.
 * @returns {number} Index of the matching closing bracket.
 */
function matchBracket(source, start) {
  let depth = 0
  let quote = null
  for (let j = start; j < source.length; j += 1) {
    const ch = source[j]
    if (quote) {
      if (ch === '\\') j += 1
      else if (ch === quote) quote = null
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch
      continue
    }
    if (ch === '[' || ch === '{') depth += 1
    else if (ch === ']' || ch === '}') {
      depth -= 1
      if (depth === 0) return j
    }
  }
  return source.length
}

/**
 * Match one `{ ... }` object literal starting at `start`, honouring string literals.
 *
 * @param {string} source
 * @param {number} start Index of the opening brace.
 * @returns {{ text: string, end: number } | undefined}
 */
function readObject(source, start) {
  let depth = 0
  let quote = null
  for (let j = start; j < source.length; j += 1) {
    const ch = source[j]
    if (quote) {
      if (ch === '\\') j += 1
      else if (ch === quote) quote = null
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch
      continue
    }
    if (ch === '{') depth += 1
    else if (ch === '}') {
      depth -= 1
      if (depth === 0) return { text: source.slice(start, j + 1), end: j }
    }
  }
  return undefined
}

/**
 * Pull scalar, simple-array, and nested-object fields out of an object literal.
 *
 * An array field is returned as a string array when it holds strings, and as an array of
 * field records when it holds objects. Chain definitions nest their steps that way, so a
 * parser that could only flatten strings would silently drop every step.
 *
 * @param {{ text: string }} body
 * @returns {Record<string, string | string[] | Array<Record<string, string | string[]>>>}
 */
function parseFields({ text }) {
  const fields = {}

  for (const m of text.matchAll(/(\w+)\s*:\s*(['"])((?:\\.|[^\\])*?)\2/g)) {
    // Groups: 1 = field name, 2 = opening quote, 3 = value.
    fields[m[1]] = m[3].replace(/\\(.)/g, '$1')
  }

  for (const m of text.matchAll(/(\w+)\s*:\s*\[/g)) {
    const open = m.index + m[0].length - 1
    const close = matchBracket(text, open)
    const inner = text.slice(open + 1, close)
    const name = m[1]

    if (inner.trimStart().startsWith('{')) {
      const records = []
      for (let i = open + 1; i < close; i += 1) {
        if (text[i] !== '{') continue
        const found = readObject(text, i)
        if (!found || found.end > close) break
        records.push(parseFields(found))
        i = found.end
      }
      fields[name] = records
    } else {
      fields[name] = [...inner.matchAll(/['"]([^'"]+)['"]/g)].map((x) => x[1])
    }
  }

  return fields
}

/**
 * Extract string values of a field across every object in a named array.
 *
 * @param {string} source
 * @param {string} name Exported constant name.
 * @param {string} field Field to collect.
 * @returns {string[]}
 */
export function fieldValues(source, name, field) {
  return extractObjects(source, name)
    .map((o) => o[field])
    .filter((v) => v !== undefined)
    .flatMap((v) => (Array.isArray(v) ? v : [v]))
}

/**
 * Format a validator report and choose an exit code.
 *
 * @param {string} title
 * @param {Record<string, unknown>} report Extra fields to print.
 * @param {string[]} errors
 * @param {string[]} warnings
 */
export function report(title, reportBody, errors, warnings) {
  console.log(
    JSON.stringify(
      { validator: title, ...reportBody, errors, warnings },
      null,
      2,
    ),
  )
  if (warnings.length > 0) {
    for (const w of warnings) console.error(`warn: ${w}`)
  }
  if (errors.length > 0) {
    for (const e of errors) console.error(`error: ${e}`)
    process.exitCode = 1
  }
}
