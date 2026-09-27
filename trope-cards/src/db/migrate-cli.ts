import process from 'node:process'

import { migrate } from './migrate'

/**
 * Entry point for `pnpm trope-graph:migrate`.
 *
 * Flags:
 *   --check         report pending and drifted migrations without writing
 *   --reset         DROP SCHEMA trope_graph CASCADE, then reapply everything
 *   --allow-remote  permit a non-loopback host (required for a shared or hosted database)
 *
 * @returns Process exit code: 0 on success, 1 on failure or checksum drift.
 */
export async function main(): Promise<number> {
  const argv = new Set(process.argv.slice(2))

  try {
    const result = await migrate({
      checkOnly: argv.has('--check'),
      reset: argv.has('--reset'),
      allowRemote: argv.has('--allow-remote'),
    })

    if (result.drift.length > 0) {
      console.error(
        'Checksum drift. These migrations were edited after being applied:',
      )
      for (const f of result.drift) console.error(`  ${f}`)
      console.error(
        '\nThe database and the migration files now disagree. Revert the file, or write a\n' +
          'new numbered migration capturing the change. Do not re-apply in place.',
      )
      return 1
    }

    console.log(result.status)
    console.log(
      `Applied ${result.applied.length}: ${result.applied.join(', ') || '(none)'}`,
    )
    console.log(
      `Skipped ${result.skipped.length}: ${result.skipped.join(', ') || '(none)'}`,
    )
    if (argv.has('--check')) console.log('\n--check: no changes written.')
    return 0
  } catch (error) {
    console.error(`\n${error instanceof Error ? error.message : String(error)}`)
    return 1
  }
}

process.exitCode = await main()
