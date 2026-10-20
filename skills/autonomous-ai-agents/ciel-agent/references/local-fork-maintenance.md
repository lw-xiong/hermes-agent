# Maintaining the local Ciel fork

The fork lives at `/media/hdd/Autism Coding/ciel-agent` (branch `ciel`, remote `upstream` = NousResearch/hermes-agent, local rollback tag `pre-cielify`). Hermes ships from the same tree via rebase, so every rule below is aimed at keeping the delta small and re-appliable.

## Invariants

- **Persona lives in code, never in a seeded file.** `ciel/persona.py` is the default identity; `SOUL.md` is a full override for the operator. `_ensure_default_soul_md` in `ciel_cli/config.py` must stay a no-op — auto-seeding writes a shorter copy of the persona that *shadows* the real one, and the agent quietly loses its voice and governance while still looking fine in `--version`. Empty home = code persona. Tests assert `not (home/"SOUL.md").exists()` and that a custom file survives untouched.
- **Ciel carries its own version.** `ciel/__init__.py` `__version__` is the product version (starts 0.1.0); the banner renders `Ciel v{__version__} (engine {derived_version}, {date})`. Never let the upstream tag become Ciel's version — a rebase bumping `v0.22.x` must not change what Ciel says it is.
- **`scripts/cielify.py` is the rename, not a manual sweep.** After any rebase run `python3 scripts/cielify.py` (idempotent, `--check` to verify clean). Never hand-edit files to re-apply the Ciel naming; never copy upstream files over the tree.

## Banner art

- **Generate the artwork from geometry; never sample a raster or photo into braille/ASCII.** Downsampling an image puts cell boundaries mid-edge, so the fill goes ragged and asymmetric — the shape reads as "broken", not stylised. Draw the form in a small function (`on(x, y)` over a pixel grid), encode it into dots/blocks, and keep the generator out of the shipped path.
- **Braille encoding: don't `rstrip()` rows to tidy the trailing blanks.** Rows then have different lengths and can't be sliced to a common origin. Keep full-width rows, compute the global bounding box (`min` first / `max` last non-blank cell across all rows), slice every row to it — all rows come out equal width and aligned.
- Two places hold the art: `ciel_cli/banner.py` (`CIEL_LOGO`, `CIEL_BRAILLE`) and `ui-tui/src/banner.ts` (`LOGO_ART`, `CADUCEUS_ART`). Change both, and keep the TS gradient array length ≥ the art row count.

## Claims about performance

Measure before proposing that something "would reduce latency". Real numbers for the PDF path:

```
spawn only (binary --version)        3.7 ms
20-page text PDF, full run           6.9 ms
4-page scanned PDF with OCR          ~32 s
```

- Embedding an external tool natively (pyo3, in-process) buys only the spawn cost. Justify it only when spawn is a visible share of the run; against OCR it is ~0.01%. Say the number and the ratio, then recommend against, instead of building the binding.
- Converters should already stream (`--stdout`), not round-trip through a temp file — check that before optimising the call site.

## Editing source in this tree

- **Use the `patch` tool for multi-line replacements.** A Python heredoc under `bash -c` mangles quoting on escaped `\n` inside string literals and dies with `SyntaxError: '(' was never closed`; one-line single-quoted `str.replace` batches are fine for mechanical sweeps, nothing larger.
- When behaviour changes, rewrite the upstream tests that encode the old behaviour in the same commit (e.g. seeding tests become "no file created" + "existing file preserved"). Leaving them skipped hides the regression on the next rebase.
- Verify with the real binary, not the import: `ciel --version` from `/tmp`, plus `ciel chat -q "In one line: who are you?"` when persona or identity code changed.
- Commit one behaviour per commit with a one-line why, then push `origin ciel`.
