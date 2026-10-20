# Maintaining a rebranded downstream fork

A fork of Ciel that presents as its own product (name, persona, logo, own commit history) while still tracking upstream releases. Applies to any rebrand fork, not one specific one.

## Shape of the fork

- One branch per product, based on a **release tag**, not `main`. Upstream moves weekly; a branch based on a tag can be rebased onto the next tag in one step.
- Keep `upstream` as a remote; `origin` is the fork. `git config rerere.enabled true` — the same conflicts replay on every rebase otherwise.
- One commit per change, one-line why. Each local patch must stay individually droppable, so a replayed patch that upstream has since fixed can be deleted instead of adapted.
- `git diff --stat <tag> HEAD` is the honest answer to "how is this different from upstream?" — most of a brand fork's diff is one word swapped per file, not behaviour.
- Committed local fixes are the real payoff: live checkouts carry loose patches that `<tool> update` erases; as commits they survive rebases.

## Sync script

A short script that: `git fetch upstream --tags`, picks the newest **release** tag, rebases, then runs the test files touched by the local commits. Two traps:

- Upstream publishes `+canary.<timestamp>` tags. Exclude them (`--exclude='*canary*'`, plus a `grep -v canary`) or the next rebase starts from unreleased code and every later rebase fights it.
- Resolve the repo root from `$(dirname "$(readlink -f "$0")")` so the symlinked script works from any cwd.
- Add a `--check` mode that prints current base tag vs newest upstream tag without rebasing.

## Rename boundary: display vs wire

Rename only what a human reads or types — banner, `--help`, wizard text, skill `author:` lines, docs prose, the command name, the product's home symlink. Keep the package name, the `UPPER_*` env namespace, and the config directory: thousands of files import the package and hundreds read the env names, so renaming them turns every upstream rebase into a whole-tree conflict.

The better move for env vars is aliasing, not renaming: one module at the top of the constants file mirrors `NEW_*` into `OLD_*` when unset, so both spellings work and zero call sites migrate:

```python
for k, v in os.environ.items():
    if k.startswith("NEW_"):
        os.environ.setdefault("OLD_" + k[4:], v)
```

Verify by setting the new name and printing what the old accessor resolves to, then `import` the constants module — it must run before anything reads the env.

## Persona as default identity

A behavioural fork should not load its personality from a skill (a skill costs a fetch and a judgment call every session). Point the harness's own default-identity constant at a module in the fork's namespace, and keep any soul/override file as the escape hatch:

- identity constant imported where the prompt is assembled, so it is present with no file present;
- separate "operating facts" block (host paths, root command) kept importable on its own, so it can be reused without the voice;
- governance rules that always apply can ride in **tool schema descriptions** (already in context every turn) instead of a skill to fetch — same rules, no load step, ~1/7 the tokens of the reference skill they replace.

## Brand assets — replace every surface, then find what dies

Surfaces that carry the mark, and what each needs:

| Surface | File |
|---|---|
| CLI/TUI banner | ASCII art constant in the CLI `banner.py` (Rich markup, `[bold #RRGGBB]…[/]`) |
| Skins | each skin's `banner_logo` string overrides the default — leave them, they are themes |
| App icons | `assets/icon.png`, `icon.ico`, `icon.icns`, `icon-mac.png`, `icon-dark.png` |
| In-app badge | the `brand-mark` component's `assetPath(...)` image |
| Web/desktop favicon | `public/apple-touch-icon.png`, `web/public/favicon.ico` |
| Icon build source | the source PNG that the icon generator reads (often under the marketing site dir) |

Regenerate from one source PNG with Pillow — no ImageMagick or chafa needed:

```python
from PIL import Image
s = Image.open(src).convert("RGBA"); s = s.crop(s.getbbox())
side = max(s.size); sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
sq.paste(s, ((side - s.width) // 2, (side - s.height) // 2))   # square, transparent pad
for p, px in [("assets/icon.png", 1024), ("public/apple-touch-icon.png", 180)]:
    sq.resize((px, px), Image.LANCZOS).save(p)
sq.resize((256, 256), Image.LANCZOS).save("assets/icon.ico",
    sizes=[(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)])
sq.resize((512, 512), Image.LANCZOS).save("assets/icon.icns")   # Pillow writes ICNS
```

Then quantize, or a 1024px RGBA icon lands at ~800 KB in git: `im.convert("RGBA").quantize(colors=256, method=Image.Quantize.FASTOCTREE).save(p, optimize=True)` — 831 KB → 26 KB.

Point the brand component at a **new** filename (`<product>-mark.png`) rather than overwriting the old art: the code change is two lines and the diff says what happened.

### Terminal art from a raster logo

A photographic/3D logo becomes mush below ~60 columns — do not ship the downsample. Two acceptable outcomes:

- **Hand-drawn mark**: a symmetric dome/shape in `▄▀█` half-blocks, 4–6 rows, one accent colour, paired with a block-letter wordmark in the repo's existing style (the `██╗ ██╔══╝` box-glyph alphabet). Keeps a constant width per row so it centres.
- **Raster half-blocks** only for abstract marks: quantize to ~8 colours first (`Image.quantize`), map each pixel pair to `▀`/`▄`/space, and merge equal-colour runs into one Rich tag (`[#RRGGBB on #RRGGBB]`). Unquantized output produces thousands of tags and a 4.5 KB constant for 7 usable lines.

Render and eyeball before committing: `Console(force_terminal=False, width=90).print(LOGO)`.

## Removing "unused" files from a fork — verify references first

Disk size is not dead weight. Before any `git rm -r <dir>`:

1. `du -sh */ | sort -h` to find the fat, then `git ls-files -z | xargs -0 du -b | sort -rn | head` — the fat is usually thousands of small files, not one big one.
2. Grep for the **name** across code, not just the path: `grep -rn "<file>" --include=*.ts --include=*.py --include=*.css .`. Zero hits is still not proof — assets are often referenced by a stem (`frames/hermes-frame-${i}.png`), so grep the directory name and the stem too.
3. Read the **build scripts**: `scripts/bundles/*.py`, `scripts/generate_icons.py`, `node_modules`-free tooling. A marketing/docs directory is frequently the source input of an icon or doc build; deleting it breaks packaging while the runtime never imports it.
4. Delete only what is both unreferenced and not a build input, then commit the deletions separately so a rebase conflict is one `git restore <path>` away from reverting.

When a deletion turns out to break a build path, `git restore <path>` immediately (staging a delete then restoring is fine) and instead replace the *content* of the input file the build reads — that gets the branding win without a conflict surface.

## Verify

- `git rm`'d tree still imports: `python3 -c "import <pkg>.<module>"`.
- Banner tests: `python3 -m pytest -q tests/ciel_cli/test_banner.py`.
- `<product> --version` prints the fork's own install directory and commit count.
- Live install untouched: `git -C <live> status --short` shows only its pre-existing modifications; hash-compare the files you edited in the fork against the live ones.
