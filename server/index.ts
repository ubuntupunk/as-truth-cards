import { createApp } from './app.js';
import { getPool } from '../trope-cards/src/db/client.js';
import {
  boundaryFindings,
  formatRuntimeRoleBoundary,
  inspectRuntimeRoleBoundary,
} from '../trope-cards/src/db/runtime-role.js';

const app = createApp();
const PORT = process.env.PORT || 3001;

/**
 * Report the privileges of the role this process actually connects with.
 *
 * The strong discovery-event guarantee (bd `as-truth-cards-nnc`) depends on the runtime
 * login role being a non-owner with DML only. Enforcement lives in the deploy gate
 * (`pnpm run trope-graph:verify-runtime-role`), because refusing to boot would take the
 * whole site down over a hardening invariant. What this does guarantee is that a weakened
 * boundary is visible in the startup log instead of being assumed away.
 *
 * A database that is unreachable is not a boot failure either: the process already serves
 * `/health` and returns per-endpoint errors, so the check only reports what it can see.
 */
async function reportRuntimeRoleBoundary(): Promise<void> {
  try {
    const boundary = await inspectRuntimeRoleBoundary(getPool());
    const findings = boundaryFindings(boundary);

    if (findings.length === 0) {
      console.log(`[db] ${formatRuntimeRoleBoundary(boundary)}`);
      return;
    }

    console.error(
      `[db] ${formatRuntimeRoleBoundary(boundary)}\n` +
        '[db] Discovery event history is immutable under DML only, because the runtime\n' +
        '[db] role can still issue DDL. Run `pnpm run trope-graph:provision-runtime-role`\n' +
        '[db] with the owner URL and restart with the non-owner runtime URL.\n' +
        findings.map((finding) => `[db]   - [${finding.code}] ${finding.message}`).join('\n')
    );
  } catch (error) {
    console.warn(
      `[db] Could not inspect the runtime role boundary: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

void reportRuntimeRoleBoundary();

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
