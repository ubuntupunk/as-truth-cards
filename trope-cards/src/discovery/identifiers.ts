/**
 * Deterministic normalization of persistent identifiers.
 *
 * Two records that name the same work must reconcile to the same key, and the only
 * reliable way to do that is to normalize each scheme's printed form to one canonical
 * form. This module is pure: the same input always yields the same output, there is no
 * I/O, no clock, and no provider knowledge beyond the shape of a DOI/PMID/… string.
 *
 * The normalized value is what `source_identifiers.normalized_value` stores and what the
 * `(scheme, normalized_value)` uniqueness rule keys on, so a discovery candidate carrying
 * a known DOI can be recognized as already-canonical instead of being re-added under a
 * different title. `value` keeps the identifier as the source printed it, for display and
 * audit; only `normalizedValue` is used for matching.
 *
 * An unknown or malformed value returns `null` rather than a best-effort string. Guessing
 * a normalized form from something that is not the identifier it claims to be is how two
 * unrelated works get merged, which is worse than leaving the identifier unmatched.
 */

/**
 * The identifier schemes the system understands.
 *
 * The vocabulary is *open* on purpose: `scheme` is a `text` column, not a database enum
 * (see `researchSources.ts`), so adding a scheme is a code change here, never a migration.
 * This list is the set the normalizer knows how to canonicalize; anything else must be
 * stored as `OTHER` with a caller-supplied normalization.
 */
export const IDENTIFIER_SCHEMES = [
  'DOI',
  'PMID',
  'PMCID',
  'ARXIV',
  'ISBN',
  'ISSN',
  'SSRN',
  'SCOPUS',
  'ACCESSION',
  'URL',
  'OTHER',
] as const

/** One recognized identifier scheme. */
export type IdentifierScheme = (typeof IDENTIFIER_SCHEMES)[number]

/**
 * An identifier with both its display form and its canonical match form.
 *
 * `value` is the identifier as printed by the source. `normalizedValue` is the scheme's
 * canonical form and is the only field safe to compare across records.
 */
export type NormalizedIdentifier = {
  readonly scheme: IdentifierScheme
  readonly value: string
  readonly normalizedValue: string
}

/** A DOI body: `10.` + a 4–9 digit registrant + `/` + a non-empty suffix. */
const DOI_PATTERN = /^10\.\d{4,9}\/\S+$/

/** Prefixes a DOI is commonly printed with, stripped before matching. */
const DOI_PREFIXES = [
  'doi:',
  'https://doi.org/',
  'http://doi.org/',
  'https://dx.doi.org/',
  'http://dx.doi.org/',
] as const

/**
 * Normalize a DOI to its bare `10.…` form: strip any `doi:`/`dx.doi.org` prefix,
 * trim, and lower-case.
 *
 * @param raw The DOI as printed, with or without a resolver prefix.
 * @returns The bare lower-cased DOI, or `null` when the value is not a DOI.
 * @example
 * ```ts
 * normalizeDoi('https://doi.org/10.1371/JOURNAL.PONE.0197326')
 * // '10.1371/journal.pone.0197326'
 * ```
 */
export function normalizeDoi(raw: string): string | null {
  let value = raw.trim()
  const lower = value.toLowerCase()
  for (const prefix of DOI_PREFIXES) {
    if (lower.startsWith(prefix)) {
      value = value.slice(prefix.length)
      break
    }
  }
  value = value.trim().toLowerCase()
  return DOI_PATTERN.test(value) ? value : null
}

/**
 * Normalize a value for one known scheme.
 *
 * @param scheme The scheme the value claims to be.
 * @param raw The value as printed.
 * @returns The normalized identifier, or `null` when the value does not fit the scheme.
 * @example
 * ```ts
 * normalizeIdentifier('PMID', ' PMID:  29772003 ')
 * // { scheme: 'PMID', value: ' PMID:  29772003 ', normalizedValue: '29772003' }
 * ```
 */
export function normalizeIdentifier(
  scheme: IdentifierScheme,
  raw: string,
): NormalizedIdentifier | null {
  const printed = raw
  const trimmed = raw.trim()
  if (trimmed.length === 0) return null

  let normalized: string | null
  switch (scheme) {
    case 'DOI':
      normalized = normalizeDoi(trimmed)
      break
    case 'PMID': {
      const body = trimmed.replace(/^pmid:?/i, '').trim()
      normalized = /^\d+$/.test(body) ? body : null
      break
    }
    case 'PMCID': {
      const body = trimmed
        .replace(/^pmcid:?/i, '')
        .replace(/^pmc/i, '')
        .trim()
      normalized = /^\d+$/.test(body) ? `PMC${body}` : null
      break
    }
    case 'ARXIV':
      normalized = trimmed
        .replace(/^arxiv:?/i, '')
        .trim()
        .toLowerCase()
      normalized = normalized.length > 0 ? normalized : null
      break
    case 'ISBN':
      normalized = nonEmpty(trimmed.replace(/[^0-9xX]/g, '').toUpperCase())
      normalized =
        normalized !== null &&
        (normalized.length === 10 || normalized.length === 13)
          ? normalized
          : null
      break
    case 'ISSN':
      normalized = nonEmpty(trimmed.replace(/[^0-9xX]/g, '').toUpperCase())
      normalized =
        normalized !== null && normalized.length === 8 ? normalized : null
      break
    case 'SSRN':
      normalized = trimmed.replace(/^ssrn:?/i, '').trim()
      normalized = /^\d+$/.test(normalized) ? normalized : null
      break
    case 'SCOPUS':
      normalized = trimmed
        .replace(/^scopus:?/i, '')
        .trim()
        .toLowerCase()
      normalized = normalized.length > 0 ? normalized : null
      break
    case 'ACCESSION':
    case 'OTHER':
      normalized = trimmed.replace(/\s+/g, ' ').toLowerCase()
      break
    case 'URL':
      normalized = normalizeUrl(trimmed)
      break
  }

  return normalized === null
    ? null
    : { scheme, value: printed, normalizedValue: normalized }
}

/** Return the value unchanged when it is non-empty, else `null`. */
function nonEmpty(value: string): string | null {
  return value.length > 0 ? value : null
}

/**
 * Normalize a URL for identity: keep the scheme and host lower-cased, strip a trailing
 * slash, and drop the fragment. The query string is kept, because a query is often part
 * of what identifies the resource.
 *
 * @param raw A URL as printed.
 * @returns The normalized URL, or `null` when it does not parse.
 */
export function normalizeUrl(raw: string): string | null {
  try {
    const url = new URL(raw.trim())
    url.hash = ''
    const rendered = url.toString()
    return rendered.endsWith('/') ? rendered.slice(0, -1) : rendered
  } catch {
    return null
  }
}

/**
 * The subset of a Crossref work record this module reads.
 *
 * Declared structurally rather than importing a provider type so the identifier layer
 * stays provider-neutral; a future adapter maps its own record onto these fields.
 */
export type CrossrefIdentifierSource = {
  readonly DOI?: unknown
  readonly URL?: unknown
  readonly ISSN?: unknown
  readonly ISBN?: unknown
}

/**
 * Extract and normalize every identifier a Crossref work supplies.
 *
 * Only the identifiers Crossref actually carries are returned; a missing field yields no
 * entry rather than a null one, so a consumer can treat the list as "identifiers present".
 * Duplicates within a scheme collapse to the first occurrence.
 *
 * @param record A Crossref `message.items[]` element.
 * @returns The normalized identifiers, in scheme order, de-duplicated.
 */
export function extractCrossrefIdentifiers(
  record: CrossrefIdentifierSource,
): NormalizedIdentifier[] {
  const found: NormalizedIdentifier[] = []
  const seen = new Set<string>()

  const add = (identifier: NormalizedIdentifier | null): void => {
    if (identifier === null) return
    const key = `${identifier.scheme}\u0000${identifier.normalizedValue}`
    if (seen.has(key)) return
    seen.add(key)
    found.push(identifier)
  }

  if (typeof record.DOI === 'string') {
    add(normalizeIdentifier('DOI', record.DOI))
  }
  if (typeof record.URL === 'string') {
    add(normalizeIdentifier('URL', record.URL))
  }
  if (Array.isArray(record.ISSN)) {
    for (const issn of record.ISSN) {
      if (typeof issn === 'string') add(normalizeIdentifier('ISSN', issn))
    }
  }
  if (Array.isArray(record.ISBN)) {
    for (const isbn of record.ISBN) {
      if (typeof isbn === 'string') add(normalizeIdentifier('ISBN', isbn))
    }
  }

  return found
}
