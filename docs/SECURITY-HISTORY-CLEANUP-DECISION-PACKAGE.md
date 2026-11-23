# Public Git history credential exposure — maintainer decision package

**Status: EXECUTED 2026-11-23 — maintainer approval received; public history rewritten and both remotes force-pushed.** Provider-side cache views and stale downstream clones remain open follow-ups (§11). No credential value is reproduced in this package.

Prepared 2026-11-23 for [Issue #9](https://github.com/ubuntupunk/as-truth-cards/issues/9) and the [Milestone Review — 2026-11-23](MILESTONE-REVIEW-2026-11-23.md).

## 1. Decision required

Commit `28e8775` introduced a test account's email address, password, and an ADMIN-escalation statement into `docs/ISSUE_9_E2E_REPORT.md`. The account has been disabled, its password rotated, active sessions revoked, the ADMIN escalation reverted, and E2E-created records purged where safe (reported by the maintainer in Issue #9; those environment actions are not re-verified here). The credential text remains reachable in public Git history on GitHub and Codeberg.

**Disposition recorded:** the maintainer approved the coordinated rewrite in §6 on 2026-11-23 and instructed the agent to proceed. Execution evidence is in §11. The rewrite was limited to the credential text; no source, schema, or product contract was changed.

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

- [x] `git rev-list --objects --all` blob scan (redacted, as in §3) reports **0** credential-token hits locally and after fetching both remotes — also verified with `GIT_NO_REPLACE_OBJECTS=1`.
- [x] `git log --all -S<token>` reports **0** commits for both tokens.
- [x] Full-ref blob scan (equivalent to `git grep` over all revisions) reports **0** hits.
- [x] Current working tree of `docs/ISSUE_9_E2E_REPORT.md` contains no credential token.
- [x] `origin/main`, `origin/HEAD`, and `codeberg/main` point at `c7a40dc1890b80f79db4d108e4bd5011f7173ee4`; no old tip is reachable from a branch.
- [x] Fork count re-checked after the rewrite: **0** forks. GitHub branch protection remains disabled.
- [x] Local checks re-run on the rewritten history: typecheck pass, 803/803 UI tests, 189/189 server tests, build pass, lint with one pre-existing warning. `pnpm run trope-graph:check` remains environment-blocked (no database connection string in this session).
- [ ] GitHub Support ticket resolved or explicitly accepted as an open follow-up — **not filed; maintainer action**.
- [x] Issue #9 and `ROADMAP.md` updated with new tip SHAs, verification evidence, and the maintainer's disposition.

## 9. Residual risk after the rewrite

Credential tokens are absent from every current ref on both remotes and from the local working tree/reflogs (old commit `28e8775` is no longer present locally). Residual risk is limited to provider-side cached HTML/API/search views, previously fetched forks or clones, and CI caches; those are explicit open follow-ups in §11. Immediate account risk remains contained by the reported rotation/disable/revocation. This rewrite does not establish release readiness.

## 10. Separate open verification boundaries (not resolved by this package)

Per the maintainer direction and the 2026-11-23 review, these remain open and require their own evidence or explicit acceptance: `trope-graph:check` environment blocker, deployed Render checks, Figma frame reconciliation, the in-card `MalformedState` live-browser case, and remaining responsive/keyboard/accessibility acceptance. Issue #9 stays open.

## 11. Execution record — 2026-11-23

**Approval:** maintainer replied `rewrite approved, proceed` on 2026-11-23. Coordination notice posted to Issue #9 (comment `7092364653`).

**Pre-flight (before any mutation):**
- Working tree clean apart from two untracked user files (`.opencode-agent-profile.md`, `note.md`), left untouched.
- GitHub `main` tip `834905929249404fa76912fe0259f6f9b4e058b0`; Codeberg `main` tip `38a24d8fb3efb1b90569c5aa46d20c49d880f317`.
- GitHub API: **0 forks**, **0 open PRs**, branch protection disabled (404). `git-filter-repo` installed (`ed61b4050b71`).
- Codeberg fork inventory remains unverifiable with configured credentials (open follow-up).

**Rewrite (fresh offline mirror only; never in the working clone):**
- `git clone --mirror` of GitHub into a restricted `/tmp` path; mirror included `refs/pull/1/head`.
- Four local redaction rules generated in memory (email, password, and two ADMIN-escalation phrases), written to an untracked `/tmp` file, never committed.
- `git filter-repo --replace-text <redactions.txt> --force` — parse/write/repack completed cleanly in ~8 s.
- Commit count preserved: **251** before and after; source/schema/product contracts unchanged.

**Verification (all passed before pushing):**
- Redacted blob scan over `rev-list --objects --all`: **0** token hits.
- Pickaxe (`git log --all -S<token>`): **0** commits for both tokens.
- Re-run with `GIT_NO_REPLACE_OBJECTS=1`: **0** hits; old commit `28e8775` not an ancestor of any branch, including `refs/pull/1/head`.
- Rewritten report contains no credential token; only a `[REDACTED]` marker.

**Remote update (coordinated, GitHub first then Codeberg):**
- First push attempt with `origin` failed (`fatal: --mirror can't be combined with refspecs`); no remote was changed. Retried with the explicit remote URL.
- GitHub: `+ 8349059...c7a40dc main -> main (forced update)`.
- Codeberg: `+ 38a24d8...c7a40dc main -> main (forced update)`.
- `git ls-remote` confirms both remotes at `c7a40dc1890b80f79db4d108e4bd5011f7173ee4`.
- Working clone fetched with `--prune`, reset hard to the new tip, reflogs expired (`git reflog expire --expire=now --all`), and `git gc --prune=now` run. Post-gc scan: **0** blob/worktree hits, old commit absent locally, both pickaxes **0**.

**Checks re-run on rewritten history:** typecheck pass; UI tests **803/803**; server tests **189/189**; build pass; lint one pre-existing warning; `pnpm run trope-graph:check` environment-blocked (no database connection string in this session). Fork count re-checked: **0**.

**Open follow-ups (not performed by this rewrite):**
- File a GitHub Support request to purge cached HTML/API/search views for old commit `28e8775` (commit + file path only, never credential values); record the ticket ID in Issue #9.
- Confirm Codeberg cache behaviour with its operators; inventory downstream clones, forks, and CI caches for stale history.
- These are tracked in a dedicated bead; Issue #9 and release readiness remain open until resolved or explicitly accepted. The inventory portion was completed on 2026-11-23; see §12.

## 12. Provider/cache inventory — 2026-11-23 (bead `as-truth-cards-zs3`)

**Scope:** determine what stale history is still reachable after the approved rewrite, and separate what can be checked from here from what needs a provider ticket or operator reply. No credential values were fetched into this record, reproduced, or sent to any provider; only commit SHA `28e87757fb858df6d97bea89a345ab731dbef36b` and the path `docs/ISSUE_9_E2E_REPORT.md` are used.

### 12.1 Refs, forks, PRs and CI caches

| Surface | Command / endpoint | Result | Interpretation |
|---|---|---|---|
| GitHub repo | `gh api repos/ubuntupunk/as-truth-cards` | `default_branch: main`, `forks: 0`, `open_issues: 6` | No known GitHub forks. |
| GitHub forks | `gh api repos/ubuntupunk/as-truth-cards/forks` | empty list | Confirms 0 forks. |
| GitHub branches | `gh api .../branches` | `main`, `dev`, `deno` | Branch names only; reachability checked below. |
| GitHub PRs | `gh api .../pulls?state=all` | single PR `#1`, closed; head `refs/pull/1/head` at `1aafe8134a3402878fe572210fe1e3b97bf1e7b2` | No open PR holding stale history. |
| GitHub Actions caches | `gh api .../actions/caches` | `total_count: 0` | No GitHub-hosted build cache to purge. |
| Codeberg repo | `GET /api/v1/repos/ubuntupunk/as-truth-cards` (unauthenticated, HTTP 200) | `forks_count: 0`, `open_pr_counter: 0`, `has_actions: false`, `default_branch: main` | Unauthenticated API access is sufficient; the earlier "unverifiable with configured credentials" note is resolved. No Codeberg Actions caches exist. |
| Codeberg forks | `GET /api/v1/repos/.../forks` | `[]` | Confirms 0 forks. |
| Codeberg branches / tags | `GET /api/v1/repos/.../branches`, `/tags` | only `main` at `f843ffaf0e27ad862ffc818100c0c50d4301072b`; no tags | No alternate Codeberg ref carrying the old commit. |
| Old SHA reachability | `gh api .../compare/<ref>...28e8775…` for `main`, `dev`, `deno` and PR head | `merge_base: null`, `status: diverged` in every case | The old commit is not an ancestor of any live GitHub ref. |
| Local clone | `git for-each-ref --contains 28e8775…`, `git cat-file -t 28e8775…`, `git reflog --all \| grep 28e8775`, grep under `.git` | no refs, no object, no reflog entry, no file hit | Working clone is clean; no leftover mirror found under `/tmp` or `/tmp/opencode`. |
| Local clones / CI config | scan of local `.git/config` files and repository workflow files | only this working clone references `as-truth-cards`; no workflow/CI cache config in the repository | No other local clone or repo-defined CI cache identified. |

Both remotes and the local clone remain at `f843ffaf0e27ad862ffc818100c0c50d4301072b` (the pushed tip after the later #13/#14/#9 documentation slices). The rewrite tip `c7a40dc1890b80f79db4d108e4bd5011f7173ee4` is an ancestor of that tip.

### 12.2 Provider-side cached views — still present

Status-only probes (response bodies discarded, commit content never read or stored):

| URL form | GitHub | Codeberg |
|---|---|---|
| HTML commit view for `28e8775…` | HTTP 200 | HTTP 200 |
| API commit view for `28e8775…` | HTTP 200 | HTTP 404 |

The direct-SHA HTML views still resolve on both providers. This is the residual exposure a force-push cannot clear. It does **not** mean a live branch points at the old commit (§12.1), and no credential value was read back during these probes.

### 12.3 Ready-to-submit GitHub Support request — NOT YET FILED

GitHub Support is a signed-in portal workflow with no public REST endpoint; no ticket can be created from `gh api`. No ticket ID exists yet, and Issue #9 must not claim one. Proposed text (copy verbatim; do not add credential values or commit content):

> **Subject:** Request to purge cached views of old commit 28e8775 in ubuntupunk/as-truth-cards
>
> Repository: `https://github.com/ubuntupunk/as-truth-cards`
> Old commit SHA: `28e87757fb858df6d97bea89a345ab731dbef36b`
> Context file: `docs/ISSUE_9_E2E_REPORT.md`
>
> This repository underwent an approved history rewrite on 2026-11-23. The old commit above is no longer reachable from any branch, tag, fork, pull request, or Actions cache. However, the direct commit HTML view and API view still return HTTP 200 when addressed by SHA. Please purge cached HTML, API and search-index views for that SHA and confirm when the purge is complete. Do not include or request the older commit contents; only the SHA and file path are needed to locate it.

**Status:** blocked on maintainer submission through the GitHub Support portal; ticket ID and provider confirmation remain outstanding.

### 12.4 Codeberg operator question — NOT YET ANSWERED

Question for Codeberg operators: for repository `ubuntupunk/as-truth-cards`, the direct-SHA HTML commit view for `28e87757fb858df6d97bea89a345ab731dbef36b` returns HTTP 200 while the corresponding API view returns HTTP 404 after the rewrite. Please confirm whether this is a cached view, whether it can be purged, and what the expected expiry is. Reply with status only; do not paste commit contents. No response has been received.

### 12.5 Residual external inventory

There are 0 GitHub forks, 0 Codeberg forks, 0 GitHub Actions caches, and no Codeberg Actions. Arbitrary third-party clones and their local caches cannot be enumerated from this repository; they remain a provider/operator/maintainer awareness item. Any clone that still holds the pre-rewrite history must be re-cloned or force-updated and must never push the old history back. Treat any new fork, mirror, CI cache, or stale clone as a fresh exposure requiring the same disposition.

### 12.6 Disposition

Completed here: ref/fork/PR/cache/clone inventory and cached-view detection; drafts for both provider contacts. Outstanding: GitHub Support purge ticket and confirmation, Codeberg operator response, and any third-party clone cleanup. `as-truth-cards-zs3` therefore remains open (external action), Issue #9 remains open (comment `7093630086` records this disposition), and 0/11 release criteria are release-verified. No product code was changed in this slice.
