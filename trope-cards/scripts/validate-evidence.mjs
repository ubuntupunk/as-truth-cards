#!/usr/bin/env node
/**
 * Evidence-layer validator.
 *
 * The archived version of this file exported a `validateEvidence(e)` function that nothing
 * called, so it reported nothing and exited 0 while checking fields (`relation`, `sourceId`)
 * that do not exist on `trope_graph.evidence_items`. It looked like a passing check.
 *
 * This version validates two things that are actually true:
 *
 *   1. The controlled vocabularies in src/db/seed/evidenceLayer.ts are well formed.
 *   2. Every evidence row in the database conforms to them, and to the rule that a
 *      QUOTATION must carry a locator.
 *
 * A note on enforcement: the evidence layer stores `type`, `locator_type`, and
 * `evidence_status` as plain `text`, not as enums, unlike every other vocabulary in the
 * schema. The vocabulary is therefore documentation rather than a constraint, and this
 * validator is currently the only thing holding it in place. That is reported as a warning
 * on every run rather than left implicit.
 *
 * The database section is skipped, not failed, when no connection string resolves, so this
 * stays runnable in a pure-source check.
 */
import { Client } from 'pg'

import { readSeed, report } from './lib/seed-parse.mjs'

const evidenceSource = readSeed('src/db/seed/evidenceLayer.ts')

const errors = []
const warnings = []

/** @param {string} name */
const vocabulary = (name) => {
  const match = evidenceSource.match(
    new RegExp(`${name}\\s*:\\s*\\[([\\s\\S]*?)\\]`),
  )
  if (!match?.[1]) {
    throw new Error(
      `Could not find vocabulary "${name}" in seed/evidenceLayer.ts.`,
    )
  }
  return [...match[1].matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1])
}

const evidenceTypes = vocabulary('evidenceTypes')
const relations = vocabulary('relations')
const strengths = vocabulary('strengths')
const locatorTypes = vocabulary('locatorTypes')

// -- Vocabulary shape --------------------------------------------------------

for (const [name, values] of Object.entries({
  evidenceTypes,
  relations,
  strengths,
  locatorTypes,
})) {
  if (values.length === 0) errors.push(`vocabulary "${name}" is empty`)
  if (new Set(values).size !== values.length) {
    errors.push(`vocabulary "${name}" contains duplicates`)
  }
  for (const v of values) {
    if (!/^[A-Z][A-Z0-9_]*$/.test(v)) {
      errors.push(`vocabulary "${name}" has non-canonical value "${v}"`)
    }
  }
}

if (!evidenceTypes.includes('QUOTATION')) {
  errors.push('vocabulary "evidenceTypes" must include QUOTATION')
}

// -- Database ----------------------------------------------------------------

/** @type {Record<string, unknown>} */
const dbReport = { checked: false, reason: 'skipped' }

const url =
  process.env.TROPE_GRAPH_DATABASE_URL ?? process.env.DATABASE_URL ?? undefined

if (!url) {
  dbReport.reason = 'skipped: no TROPE_GRAPH_DATABASE_URL or DATABASE_URL set'
  warnings.push(
    'Database checks skipped. Set TROPE_GRAPH_DATABASE_URL to validate evidence rows.',
  )
} else {
  // Inlined rather than imported from src/db/url.ts, because this validator runs under
  // plain `node` alongside the other three, which cannot load TypeScript. `pg` resolves an
  // empty host to TCP localhost, where a local install expects scram-sha-256 and the
  // connection fails, so a passwordless loopback URL is rewritten onto the socket.
  const config = (() => {
    let parsed
    try {
      parsed = new URL(url)
    } catch {
      return { connectionString: url }
    }
    if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
      return { connectionString: url }
    }
    const loopback = ['', 'localhost', '127.0.0.1', '[::1]', '::1']
    if (
      parsed.password !== '' ||
      !loopback.includes(parsed.hostname.toLowerCase())
    ) {
      return { connectionString: url }
    }
    return {
      host: process.env.PGHOST ?? '/var/run/postgresql',
      database: decodeURIComponent(parsed.pathname.replace(/^\//, '')),
      user: decodeURIComponent(parsed.username),
    }
  })()

  const client = new Client(config)
  try {
    await client.connect()
    dbReport.checked = true
    dbReport.reason = 'checked'

    const { rows: tableRows } = await client.query(`
      SELECT count(*)::int AS n
      FROM information_schema.tables
      WHERE table_schema = 'trope_graph' AND table_name = 'evidence_items'
    `)
    if (tableRows[0]?.n !== 1) {
      errors.push(
        'trope_graph.evidence_items does not exist; run the migrations',
      )
    } else {
      const { rows } = await client.query(
        `SELECT e.id, e.type, e.locator_type, e.locator, e.evidence_status,
                (SELECT count(*) FROM trope_graph.evidence_sources s
                  WHERE s.evidence_id = e.id) AS source_count
           FROM trope_graph.evidence_items e`,
      )
      dbReport.evidenceItems = rows.length

      for (const row of rows) {
        const where = `evidence ${row.id}`
        if (!evidenceTypes.includes(row.type)) {
          errors.push(
            `${where}: type "${row.type}" is not in the documented vocabulary`,
          )
        }
        if (row.locator_type && !locatorTypes.includes(row.locator_type)) {
          errors.push(
            `${where}: locator_type "${row.locator_type}" is not in the documented vocabulary`,
          )
        }
        // `evidence_status` is deliberately not checked against `strengths`. The two describe
        // different things: `strengths` is how firmly an item bears on a claim, while
        // `evidence_status` describes the item itself. EVIDENCE_LAYER.md states the three
        // status vocabularies must never be collapsed into one, and it does not enumerate
        // values for `evidence_status`, so there is nothing to validate it against. The
        // documented rule is the provenance requirement below.
        if (
          row.evidence_status === 'PRIMARY' &&
          Number(row.source_count) === 0
        ) {
          errors.push(`${where}: PRIMARY evidence requires source provenance`)
        }
        // A quotation without a locator cannot be checked by a reader, which defeats the
        // purpose of recording it as a quotation.
        if (row.type === 'QUOTATION' && !row.locator) {
          errors.push(`${where}: QUOTATION evidence requires a locator`)
        }
      }

      if (rows.length === 0) {
        warnings.push(
          'evidence_items is empty. The evidence layer is schema-only so far; no located ' +
            'passages have been recorded. This is expected at this stage of the project.',
        )
      }
    }

    // Confirm the unenforced-text finding rather than asserting it from memory.
    const { rows: enumRows } = await client.query(`
      SELECT a.attname, format_type(a.atttypid, a.atttypmod) AS coltype
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'trope_graph' AND c.relname = 'evidence_items'
        AND a.attnum > 0 AND NOT a.attisdropped
        AND a.attname IN ('type', 'locator_type', 'evidence_status')
    `)
    const asText = enumRows
      .filter((r) => r.coltype === 'text')
      .map((r) => r.attname)
    dbReport.unenforcedTextColumns = asText.sort()
    if (asText.length > 0) {
      warnings.push(
        `evidence_items.${asText.join(', evidence_items.')} are plain text, so the evidence ` +
          'vocabularies are not enforced by the database. Every other vocabulary in ' +
          'trope_graph is an enum. This validator is currently the only guard.',
      )
    }
  } catch (error) {
    dbReport.checked = false
    dbReport.reason = `error: ${error instanceof Error ? error.message : String(error)}`
    errors.push(`database checks failed: ${dbReport.reason}`)
  } finally {
    await client.end().catch(() => {})
  }
}

report(
  'validate-evidence',
  {
    vocabulary: {
      evidenceTypes: evidenceTypes.length,
      relations: relations.length,
      strengths: strengths.length,
      locatorTypes: locatorTypes.length,
    },
    database: dbReport,
  },
  errors,
  warnings,
)
