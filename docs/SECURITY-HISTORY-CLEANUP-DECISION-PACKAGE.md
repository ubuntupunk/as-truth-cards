# Public Git history credential exposure — maintainer decision package

**Status: PLAN ONLY — PENDING MAINTAINER APPROVAL. No history rewrite, force-push, branch-protection change, or remote mutation has been performed.** This package exists so the maintainer can decide the disposition of an already-contained exposure. It does not accept risk on the maintainer's behalf.

Prepared 2026-11-23 for [Issue #9](https://github.com/ubuntupunk/as-truth-cards/issues/9) and the [Milestone Review — 2026-11-23](MILESTONE-REVIEW-2026-11-23.md).

## 1. Decision required

Commit `28e8775` introduced a test account's email address, password, and an ADMIN-escalation statement into `docs/ISSUE_9_E2E_REPORT.md`. The account has been disabled, its password rotated, active sessions revoked, the ADMIN escalation reverted, and E2E-created records purged where safe (reported by the maintainer in Issue #9; those environment actions are not re-verified here). The credential text remains reachable in public Git history on GitHub and Codeberg.

The maintainer must choose one disposition:

1. **Approve the coordinated rewrite** in §6, including force-push to both remotes and downstream coordination.
2. **Reject/defer the rewrite** and keep the exposure as an explicitly open follow-up with an owner and review date.
3. **Retain history with explicitly accepted residual risk** — an explicit maintainer statement, not an agent assumption.

Until a decision is recorded, the exposure is **open, not accepted**.

## 2. Affected refs and remotes

Scan date 2026-11-23 against the local clone at `main` = `27d728329ade121187de5530ff86d2c6751327a8`.

| Ref | Tip | Contains `28e8775` | Notes |
| --- | --- | --- | --- |
| `refs/heads/main` | `27d728329ade121187de5530ff86d2c6751327a8` | yes | working branch |
| `refs/remotes/origin/main` (GitHub) | `27d728329ade121187de5530ff86d2c6751327a8` | yes | public, current tip |
| `refs/remotes/origin/HEAD` | `27d728329ade121187de5530ff86d2c6751327a8` | yes | symbolic ref to `origin/main` |
| `refs/remotes/codeberg/main` | `38a24d8fb3efb1b90569c5aa46d20c49d880f317` | yes | public, behind GitHub tip but history includes the commit |
| `refs/heads/dev` / `refs/remotes/origin/dev` | `eb30d561ca65b0862c54f321d84419d545ea3e65` | no | unaffected |
| `refs/remotes/origin/deno` | `7ab5c3f4fd2404bf950b366ff546b603d2f27e05` | no | unaffected |
| `refs/heads/debug` | `e61cc9beca5c5341ad236d6f46f699b245bde0c1` | no | unaffected |
| `refs/stash` | `ff0ee27` (working tree: `opencode.json` only) | no | unaffected |
| Tags | none | n/a | `git tag --contains 28e8775` returned no tags |
| `refs/ai-working-log/*` | multiple | n/a | blob scan found no credential tokens outside the report path |

Remotes configured in this clone:

- `origin` → `git@github.com-as-truth-cards:ubuntupunk/as-truth-cards.git`
- `codeberg` → `git@codeberg.org-as-truth-cards:ubuntupunk/as-truth-cards.git`

## 3. Redacted scan findings

Method: the credential tokens were extracted from the historical blob in memory, never written to a report, issue, or log; the scan output contains only lengths, short SHA-256 fingerprints, object IDs, paths, and commit IDs. **No credential value is reproduced in this package.**

- Token fingerprints: email `len=35 sha256_12=00bf316b07e3`; password `len=17 sha256_12=1d5d52f0ad01`.
- Reachable Git blobs containing either token: **4**, all at `docs/ISSUE_9_E2E_REPORT.md`:

| Commit | Blob | Tokens present |
| --- | --- | --- |
| `28e87757fb858df6d97bea89a345ab731dbef36b` | `1e3b6535f24f` | email + password |
| `111f869a8d77507fd9b31f25507a68f040066657` | `4a41596452f6` | email |
| `ca06e4c579a61f3a3de24228bf68141e230e6b34` | `e563a6db35e8` | email |
| `5911f231aa95223d33387818d48b5815e29598d3` (and current `main`) | `b810ef538c04` | email |

- Pickaxe (`git log --all -S<token>`): email introduced by `28e8775`; password introduced by `28e8775` and removed by `111f869`.
- Working-tree scan at the start of this slice: **1 hit** — the email remained in the remediation section of the current report. It has been removed in this slice (uncommitted at scan time; re-scan required after commit). The password was already absent from the working tree.
- GitHub Issue #9 comments: **0 of 53** contain either token.
- Stash and non-report refs: **0 hits**.

Conclusion: current working tree can be made clean without touching history; historical blobs on both public remotes cannot be cleaned without a rewrite or provider-side purge.

## 4. Downstream consumers and branches

| Consumer | Status / action |
| --- | --- |
| GitHub forks | `gh api repos/ubuntupunk/as-truth-cards/forks` → **0 forks** at scan time. Re-check immediately before any rewrite. |
| Codeberg forks / mirrors | Not queryable with configured credentials. Maintainer must inventory before a rewrite. |
| Local branches | `dev`, `debug`, and `origin/deno` do not contain `28e8775`; no action. `main` does. |
| CI caches, open PR branches, downstream developer clones | Cannot be enumerated from this machine. Maintainers must inventory all clones and CI systems; stale clones can re-push the old history after a force-push. |
| GitHub cached views / search index | A force-push does **not** clear cached HTML, API responses, or search results for the old commit. Provider support is required (§7). |

## 5. Recovery and rollback

If a rewrite is approved:

1. Before touching the working repository, clone a full mirror to a restricted local path and keep it **offline** — never push a backup ref containing the old history to either remote.
2. Record the pre-rewrite tip SHAs from §2 in the change ticket and in the maintainer's notes.
3. Perform the rewrite only in the fresh mirror clone, with a redactions file that is **not committed** and is deleted/shredded after verification.
4. If any post-rewrite check fails, discard the rewritten mirror and continue from the untouched working clone. Do not force-push until every check in §8 passes.
5. After both remotes are updated, rollback means force-pushing the recorded pre-rewrite tips from the offline mirror — this restores the exposure and is therefore a maintainer-only emergency action requiring a new decision.
6. Delete local reflogs/backup refs only after the maintainer confirms both remotes and caches are in the desired state.

## 6. Coordinated rewrite sequence (NOT EXECUTED)

1. **Pre-flight:** freeze merges; `bd sync`; confirm GitHub and Codeberg tips match §2; re-check forks and branch protection; notify all contributors with a maintenance window.
2. **Local rewrite (single operator, fresh mirror only):** `git filter-repo --replace-text <redactions.txt>`, redacting the email, password, and ADMIN-escalation line across all reachable history. No `filter-branch` on the working clone.
3. **Local verification:** run §8 against the mirror. Only proceed if clean.
4. **Force-push (maintainer performs or explicitly delegates):** push rewritten `main` to GitHub, then Codeberg, in the announced window. GitHub branch protection is currently **not enabled** (`branches/main/protection` returned 404); Codeberg protection is unverified and must be checked before the push.
5. **Downstream coordination:** every clone re-fetches or re-clones; open PR branches re-based or closed; CI caches purged; forks re-synced or deleted. Stale clones must not push old history.
6. **Provider cache purge:** submit GitHub Support's secret/history purge request for the affected commit (§7). Codeberg cache behaviour must be confirmed with its operators.
7. **Post-check:** re-run §8 against both remotes and the maintainer's reference clone; update Issue #9 with the new tip SHAs and the disposition.

## 7. GitHub cache / support actions

- Force-push changes refs, not GitHub's cached HTML, search index, or previously issued API responses.
- Open a GitHub Support request identifying commit `28e87757fb858df6d97bea89a345ab731dbef36b` and the repository, asking for cached views and search-index purge of the exposed content.
- Do not paste credential values into the support request; reference the commit and file path.
- Record the support ticket ID in Issue #9 and keep the exposure listed as open until the ticket is resolved or explicitly accepted.

## 8. Post-rewrite verification checklist

- [ ] `git rev-list --objects --all` blob scan (redacted, as in §3) reports **0** credential-token hits locally and after fetching both remotes.
- [ ] `git log --all -S<token>` reports **0** commits for both tokens.
- [ ] `git grep` over all revisions, or equivalent full-ref scan, reports **0** hits.
- [ ] Current working tree of `docs/ISSUE_9_E2E_REPORT.md` contains no credential token.
- [ ] `origin/main`, `origin/HEAD`, and `codeberg/main` point at the rewritten commits, with no old tip reachable from a branch.
- [ ] Fork count re-checked; no fork still advertises the old tip.
- [ ] CI re-run on the rewritten history is green under the repository's documented checks.
- [ ] GitHub Support ticket resolved or explicitly accepted as an open follow-up.
- [ ] Issue #9 and `ROADMAP.md` updated with new tip SHAs, verification evidence, and the maintainer's disposition.

## 9. Residual risk while pending

The exposed text remains publicly reachable at `28e8775` and its descendants on GitHub and Codeberg, including cached views. Immediate account risk is contained by the reported rotation/disable/revocation, but the historical exposure is **open and not accepted**. This package must not be read as permission to rewrite or as a claim that release readiness is established.

## 10. Separate open verification boundaries (not resolved by this package)

Per the maintainer direction and the 2026-11-23 review, these remain open and require their own evidence or explicit acceptance: `trope-graph:check` environment blocker, deployed Render checks, Figma frame reconciliation, the in-card `MalformedState` live-browser case, and remaining responsive/keyboard/accessibility acceptance. Issue #9 stays open.
