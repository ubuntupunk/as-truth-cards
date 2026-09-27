// Lightweight validation rules for imported evidence records.
export function validateEvidence(e) {
  const errors = [];
  if (!e.sourceId) errors.push("Evidence must identify a source.");
  if (!e.type) errors.push("Evidence type is required.");
  if (!e.relation) errors.push("Evidence relation is required.");
  if (e.type === "QUOTATION" && !e.locator) errors.push("Quotation requires a locator.");
  if (e.evidenceStatus === "PRIMARY" && !e.sourceId) errors.push("Primary evidence requires source provenance.");
  return errors;
}
