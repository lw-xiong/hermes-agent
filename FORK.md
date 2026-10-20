# ciel-agent

Ciel's body: a fork of [Hermes](https://github.com/NousResearch/hermes-agent) (MIT) whose default
identity, brand and local fixes live in the tree instead of in loose patches.

## Branches

- `ciel` — ours. Base tag `v0.22.2`, 9 commits on top, pushed to `origin`.
- `upstream/main` — Nous Research. Never commit here; rebase onto release tags.

## Sync

```
ciel-sync --check   # newest upstream release tag vs current base
ciel-sync           # fetch → rebase onto that tag → run the touched tests
```

Canary tags (`v0.22.2+canary.*`) are excluded on purpose: rebasing onto unreleased code makes
every subsequent rebase a fight.

## What the delta is

| Commit subject | Why |
| --- | --- |
| Read scanned PDFs through tingbudont OCR | `NeedsOcrError` used to dead-end the agent |
| skill_manage: add a `rename` action | sole-op like `delete` |
| spill_overrides returns `[]` | let llama.cpp auto-fit on small cards |
| Gate the hermes_env rule on a verb | a bare path mention shouldn't trip the threat rule |
| Probe a custom endpoint with its configured key | catalog otherwise fails to load |
| Make Ciel the default identity | `ciel/persona.py`, imported at one line |
| Carry the persona's operating facts | host facts beside the persona, so the persona stays portable |
| Say Ciel everywhere the product names itself | display strings + skill frontmatter author |
| Add ciel-sync | rebase + touched tests in one command |

## Renamed vs kept

Renamed: display strings (`Hermes Agent` → `Ciel`), banner (`Ciel v…`), skill frontmatter
`author:`, console entry point `ciel` next to `hermes`.

Kept, deliberately — these are wire format, not brand:

- `HERMES_*` env vars and `hermes.*` config keys (gateway unit, MCP servers, cron, skills read them)
- the `hermes_cli` / `agent` package names (renaming them turns every upstream rebase into a
  whole-tree conflict)
- `~/.hermes` (load-bearing symlink to `/media/hdd/hermes`)
- `docs/` prose, which documents upstream tooling

## Rules

1. New behaviour goes in `ciel/`, imported from one line in an upstream file.
2. Never rename an upstream module or env var for aesthetics.
3. One commit per change, one-line why, so a conflicting commit can be dropped alone.
4. Anything generally useful goes upstream as a PR; the fork keeps only what is ours.
