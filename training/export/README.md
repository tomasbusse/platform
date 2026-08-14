# Convex export to fine-tuning dataset

This directory turns the `contentBlocks` and `aiContent` tables from a Convex
snapshot into chat-format JSONL suitable for supervised fine-tuning. The tools
use Python 3.12 and the standard library; only the tests require pytest.

## Create a Convex snapshot

Run the export from the repository root. For the development deployment, set
`CONVEX_DEPLOYMENT` to the dev deployment in `.env.local`, then run:

```sh
npx convex export --path snapshot.zip
```

To export production explicitly, run:

```sh
npx convex export --path snapshot.zip --prod
```

Keep snapshots and generated datasets out of version control because they can
contain proprietary training content.

## Build the dataset

From `training/export/`, run:

```sh
python export_dataset.py --snapshot snapshot.zip --out ../data --min-pairs 500 --val-split 0.05 --seed 42
```

The exporter accepts these flags:

- `--snapshot PATH` (required): Convex export zip to read.
- `--out DIRECTORY` (required): destination for `train.jsonl`, `val.jsonl`, and
  `stats.json`; the directory is created when needed.
- `--min-pairs INTEGER` (default `500`): minimum post-filter, post-dedup pair
  count required to pass the gate.
- `--val-split FLOAT` (default `0.05`): fraction assigned to validation after a
  deterministic shuffle.
- `--seed INTEGER` (default `42`): shuffle seed.
- `--include-seed`: opt seed-corpus content into Task A eligibility.

Seed-corpus rows are excluded by default because they teach format, not
Simmonds house style. Passing `--include-seed` makes them eligible, but it does
not bypass rejection or rights filtering.

The hard rights gate is not flag-controlled. It always drops eligible
`contentBlocks` rows whose `rightsStatus` is `cc_by_sa` or `unknown`.

## Check the gate without writing files

```sh
python gate_check.py --snapshot snapshot.zip --min-pairs 500
```

`gate_check.py` accepts `--snapshot PATH`, `--min-pairs INTEGER` (default
`500`), and `--include-seed`. It prints the same stats-shaped report as
`stats.json` but never writes dataset files.

Both commands exit `0` when the final pool contains at least `--min-pairs`
examples and exit `2` when it does not. The default gate of 500 means training
should not proceed until 500 usable examples remain after eligibility checks,
the hard rights gate, and assistant-content deduplication. The exporter still
writes all three output files before returning exit code `2`.

## Run tests

From the repository root:

```sh
python3 -m pytest training/export/ -v
```

If pytest is not installed in the active environment:

```sh
uv run --with pytest -m pytest training/export/ -v
```
