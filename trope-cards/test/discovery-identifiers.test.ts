import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  extractCrossrefIdentifiers,
  normalizeDoi,
  normalizeIdentifier,
  normalizeUrl,
} from '../src/discovery/identifiers'

/**
 * Deterministic normalization is the whole point of the identifier layer: if two records
 * for one work normalize differently, they are never reconciled; if two different works
 * normalize the same, they are wrongly merged. These tests pin both directions.
 */

describe('normalizeDoi', () => {
  it('strips resolver prefixes and lower-cases the bare DOI', () => {
    assert.equal(
      normalizeDoi('https://doi.org/10.1371/JOURNAL.PONE.0197326'),
      '10.1371/journal.pone.0197326',
    )
    assert.equal(normalizeDoi('doi:10.1000/ABC'), '10.1000/abc')
    assert.equal(normalizeDoi('http://dx.doi.org/10.1000/XyZ'), '10.1000/xyz')
  })

  it('trims surrounding whitespace', () => {
    assert.equal(normalizeDoi('  10.1000/xyz  '), '10.1000/xyz')
  })

  it('rejects values that are not DOIs', () => {
    assert.equal(normalizeDoi('10.12/journal'), null)
    assert.equal(normalizeDoi('not-a-doi'), null)
    assert.equal(normalizeDoi(''), null)
  })

  it('is idempotent', () => {
    const once = normalizeDoi('https://doi.org/10.1000/ABC')
    assert.equal(once, normalizeDoi(once!))
  })
})

describe('normalizeIdentifier', () => {
  it('normalizes a PubMed id to digits', () => {
    assert.deepEqual(normalizeIdentifier('PMID', ' PMID:  29772003 '), {
      scheme: 'PMID',
      value: ' PMID:  29772003 ',
      normalizedValue: '29772003',
    })
  })

  it('normalizes a PMC id to the PMC prefix', () => {
    assert.equal(
      normalizeIdentifier('PMCID', 'pmcid: 12345')?.normalizedValue,
      'PMC12345',
    )
    assert.equal(
      normalizeIdentifier('PMCID', 'PMC12345')?.normalizedValue,
      'PMC12345',
    )
  })

  it('lower-cases an arXiv id and strips its prefix', () => {
    assert.equal(
      normalizeIdentifier('ARXIV', 'arXiv:2101.00001')?.normalizedValue,
      '2101.00001',
    )
  })

  it('collapses ISBN and ISSN separators', () => {
    assert.equal(
      normalizeIdentifier('ISBN', '978-0-306-40615-7')?.normalizedValue,
      '9780306406157',
    )
    assert.equal(
      normalizeIdentifier('ISSN', '0378-5955')?.normalizedValue,
      '03785955',
    )
  })

  it('rejects an ISBN or ISSN of the wrong length', () => {
    assert.equal(normalizeIdentifier('ISBN', '123'), null)
    assert.equal(normalizeIdentifier('ISSN', '12345'), null)
  })

  it('rejects a PMID that is not digits', () => {
    assert.equal(normalizeIdentifier('PMID', 'abc'), null)
  })

  it('keeps the display value verbatim', () => {
    const result = normalizeIdentifier('DOI', 'https://doi.org/10.1371/AbC')
    assert.equal(result?.value, 'https://doi.org/10.1371/AbC')
    assert.equal(result?.normalizedValue, '10.1371/abc')
  })
})

describe('normalizeUrl', () => {
  it('drops the fragment and a trailing slash', () => {
    assert.equal(
      normalizeUrl('https://example.org/a/#frag'),
      'https://example.org/a',
    )
    assert.equal(normalizeUrl('https://example.org/'), 'https://example.org')
  })

  it('keeps a query string, which often identifies the resource', () => {
    assert.equal(
      normalizeUrl('https://example.org/a?doi=10.1/x'),
      'https://example.org/a?doi=10.1/x',
    )
  })

  it('rejects a non-URL', () => {
    assert.equal(normalizeUrl('not a url'), null)
  })
})

describe('extractCrossrefIdentifiers', () => {
  it('extracts DOI, URL, each ISSN and each ISBN', () => {
    const identifiers = extractCrossrefIdentifiers({
      DOI: '10.1000/ABC',
      URL: 'https://doi.org/10.1000/abc',
      ISSN: ['0378-5955', '0378-5955'],
      ISBN: ['978-0-306-40615-7'],
    })
    assert.deepEqual(
      identifiers.map((i) => [i.scheme, i.normalizedValue]),
      [
        ['DOI', '10.1000/abc'],
        ['URL', 'https://doi.org/10.1000/abc'],
        ['ISSN', '03785955'],
        ['ISBN', '9780306406157'],
      ],
    )
  })

  it('collapses duplicates within a scheme', () => {
    const identifiers = extractCrossrefIdentifiers({
      ISSN: ['0378-5955', '0378-5955'],
    })
    assert.equal(identifiers.length, 1)
  })

  it('returns nothing when no identifier is present', () => {
    assert.deepEqual(extractCrossrefIdentifiers({}), [])
  })
})
