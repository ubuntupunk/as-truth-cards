import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const seed = fs.readFileSync(path.join(root, "src/db/seed/argumentChains.ts"), "utf8");
const checks = {
  hasChains: seed.includes("chains:"),
  hasCounterSteps: seed.includes('role: "COUNTER"'),
  hasStepRelations: seed.includes("stepRelations:"),
  hasChallenge: seed.includes('relationType: "CHALLENGES"'),
  hasQualifies: seed.includes('relationType: "QUALIFIES"'),
};
const valid = Object.values(checks).every(Boolean);
const report = { valid, checks };
fs.writeFileSync(path.join(root, "validation-report.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
if (!valid) process.exit(1);
