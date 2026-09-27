# Preserved versions

One directory per release of the Trope Graph, kept for provenance. Nothing here
is imported by the current build: the working code is `../src`, `../drizzle`,
and `../scripts`. These trees are the historical record of how the model
changed, and the reason the canonical migration history in `../drizzle/` reads
the way it does.

| Directory | Version | Contents |
| --- | --- | --- |
| `trope-graph/` | v0.1 | First schema, taxonomy, 45 draft cards, migration `0001` |
| `trope-graph-schema-v0.2/` | v0.2 | Seed runner, draft validator, `TROPE_GRAPH_MIGRATION` |
| `trope-graph-v0.3/` | v0.3 | Claim extraction pilot, `SCHEMA_REFINEMENT_V0.3` |
| `trope-graph-v0.4/` | v0.4 | 152-claim corpus with source requirements |
| `trope-graph-v0.5/` | v0.5 | Identity-retrospection cluster |
| `trope-graph-v0.6-addendum/` | v0.6 | Retrospective identity cards and claims |
| `trope-graph-v0.7-claim-decomposition/` | v0.7 | Inference steps, premises, conclusions, migration `0002` |
| `trope-graph-v0.8-argument-chain-engine/` | v0.8 | Argument chains and step relations, migration `0003` |
| `trope-graph-v0.9-evidence-layer/` | v0.9 | Evidence schema, migration `0004` |

## Provenance of v0.1-v0.4

v0.1 through v0.4 were originally distributed as
`trope-graph-schema-v0.{1,2,3,4}.tar.gz` at the root of `trope-cards/`. Those
archives were extracted into this directory and the tarballs deleted, since a
compressed archive that is also present as a readable tree is pure duplication.

All four are byte-identical to their archives. The tarballs are reachable from
git history, so this stays checkable after the consolidation commit removes
them from the working tree:

```sh
# The commit that deleted the tarballs; its parent still has them.
commit=$(git log --diff-filter=D --format=%H -1 -- 'trope-cards/trope-graph-schema-v0.1.tar.gz')

mkdir -p /tmp/verify && cd /tmp/verify
for v in 1 2 3 4; do
  git -C /path/to/repo show "$commit^:trope-cards/trope-graph-schema-v0.$v.tar.gz" > "v0.$v.tar.gz"
  mkdir -p "out$v"
  tar xzf "v0.$v.tar.gz" -C "out$v" --strip-components=1
done

diff -r out1 /path/to/repo/trope-cards/versions/trope-graph
diff -r out2 /path/to/repo/trope-cards/versions/trope-graph-schema-v0.2
diff -r out3 /path/to/repo/trope-cards/versions/trope-graph-v0.3
diff -r out4 /path/to/repo/trope-cards/versions/trope-graph-v0.4
```

Each `diff` should report nothing.

v0.5 onward never shipped as archives; these trees are the original
directories.

## Naming

The directory names are not uniform. `trope-graph/` and
`trope-graph-schema-v0.2/` are the original names from those releases;
v0.3 onward added the version suffix. They are left as they are rather than
renamed, so the names still match what each release actually called itself.
