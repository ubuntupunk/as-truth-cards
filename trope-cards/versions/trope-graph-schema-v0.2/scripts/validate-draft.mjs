#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const seedPath = path.join(root, 'src/db/seed/draftCards.ts');
const text = fs.readFileSync(seedPath, 'utf8');

const allowedTypes = new Set(['TACTIC','FACT','THEOLOGY','CASE','REFERENCE']);
const allowedStatuses = new Set(['ESTABLISHED','CONTESTED','OPEN','CONTEXT_DEPENDENT','UNSUPPORTED','LIVE']);
const requiredCollections = new Set(['classic','zionism-coded','south-africa','fact-rebuttal','foundational']);
const knownMechanisms = new Set([
  'inversion','conspiracy','substitution','collectivisation','exclusion','equivalence',
  'double-standard','essentialisation','context-stripping','demonisation',
  'guilt-by-association','racial-essentialism'
]);

const rows = [...text.matchAll(/\{ slug: "([^"]+)", title: "([^"]+)", collection: \[([^\]]+)\], primaryType: "([^"]+)", status: "([^"]+)", axis: \[([^\]]*)\](?:, mechanisms: \[([^\]]*)\])?/g)]
  .map(m => ({
    slug: m[1], title: m[2],
    collections: [...m[3].matchAll(/"([^"]+)"/g)].map(x => x[1]),
    primaryType: m[4], status: m[5],
    axis: [...m[6].matchAll(/"([^"]+)"/g)].map(x => x[1]),
    mechanisms: m[7] ? [...m[7].matchAll(/"([^"]+)"/g)].map(x => x[1]) : [],
  }));

const errors = [];
const warnings = [];
const seen = new Set();

for (const row of rows) {
  if (seen.has(row.slug)) errors.push(`${row.slug}: duplicate slug`);
  seen.add(row.slug);
  if (!allowedTypes.has(row.primaryType)) errors.push(`${row.slug}: invalid type ${row.primaryType}`);
  if (!allowedStatuses.has(row.status)) errors.push(`${row.slug}: invalid status ${row.status}`);
  for (const c of row.collections) if (!requiredCollections.has(c)) errors.push(`${row.slug}: unknown collection ${c}`);
  for (const m of row.mechanisms) if (!knownMechanisms.has(m)) errors.push(`${row.slug}: unknown mechanism ${m}`);
  if (row.primaryType === 'CASE' && !row.collections.includes('south-africa')) {
    warnings.push(`${row.slug}: CASE outside South Africa collection; verify intentional.`);
  }
  if (row.status === 'LIVE' && row.primaryType !== 'CASE') {
    warnings.push(`${row.slug}: LIVE status on non-CASE object; verify update lifecycle.`);
  }
  if (row.primaryType === 'THEOLOGY' && !row.axis.includes('THEOLOGICAL')) {
    warnings.push(`${row.slug}: THEOLOGY should normally carry THEOLOGICAL axis.`);
  }
  if (row.primaryType === 'TACTIC' && !row.axis.includes('TACTIC')) {
    warnings.push(`${row.slug}: TACTIC should normally carry TACTIC axis.`);
  }
}

const by = (key) => Object.fromEntries([...rows.reduce((m,r) => m.set(r[key], (m.get(r[key])||0)+1), new Map())]);
const mechanismUse = {};
for (const r of rows) for (const m of r.mechanisms) mechanismUse[m] = (mechanismUse[m]||0)+1;

const report = {
  corpus: { expected: 41, parsed: rows.length, ok: rows.length === 41 },
  types: by('primaryType'),
  statuses: by('status'),
  collections: [...rows.reduce((m,r)=>{ for(const c of r.collections)m.set(c,(m.get(c)||0)+1); return m;},new Map())].reduce((o,[k,v])=>(o[k]=v,o),{}),
  mechanismUse,
  errors,
  warnings,
};

console.log(JSON.stringify(report, null, 2));
process.exit(errors.length ? 1 : 0);
