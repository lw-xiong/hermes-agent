# ciel-agent

Ciel's body: a fork of [Hermes](https://github.com/NousResearch/hermes-agent) (MIT). The tree says
Ciel everywhere — packages, modules, env vars, paths, docs. Upstream stays the source of the engine;
this fork re-implements upstream changes on top of that rename.

## Branches

- `ciel` — ours. Base tag `v0.22.2`, pushed to `origin`.
- `upstream/main` — Nous Research. Never commit here; rebase onto release tags.

## Sync

```
ciel-sync --check   # newest upstream release tag vs current base
ciel-sync           # fetch → rebase onto that tag → re-apply rename → run the touched tests
```

`ciel-sync` runs `scripts/cielify.py` after the rebase. Upstream files arrive naming themselves
`hermes`; the script puts them back into Ciel shape and is idempotent, so a rebase only ever touches
the new lines. Never copy upstream files over this tree by hand — that reintroduces `hermes` and
loses the local fixes.

Canary tags (`v0.22.2+canary.*`) are excluded on purpose: rebasing onto unreleased code makes
every subsequent rebase a fight.

## What the delta is

| Commit subject | Why |
| --- | --- |
| Read scanned PDFs through tingbudont OCR | `NeedsOcrError` used to dead-end the agent |
| skill_manage: add a `rename` action | sole-op like `delete` |
| spill_overrides returns `[]` | let llama.cpp auto-fit on small cards |
| Gate the ciel_env rule on a verb | a bare path mention shouldn't trip the threat rule |
| Probe a custom endpoint with its configured key | catalog otherwise fails to load |
| Make Ciel the default identity | `ciel/persona.py`, imported at one line |
| Carry the persona's operating facts | host facts beside the persona, so the persona stays portable |
| Put skill-library governance inside `skill_manage` | present at the moment of editing, not fetched |
| Say Ciel everywhere the product names itself | display strings + skill frontmatter author |
| Rename the tree, not just the display strings | `scripts/cielify.py` |
| Add ciel-sync | rebase + rename + touched tests in one command |

## What the rename covers (`scripts/cielify.py`)

| From | To |
| --- | --- |
| `hermes_cli/`, `hermes_state*.py`, `hermes_*.py` | `ciel_cli/`, `ciel_state*.py`, `ciel_*.py` |
| `HERMES_*` env vars | `CIEL_*` (`ciel/env.py` still mirrors `CIEL_*` → `HERMES_*` for third-party plugins) |
| `~/.hermes`, `hermes.*` config keys | `~/.ciel`, `ciel.*` |
| `Hermes Agent`, `Hermes`, `hermes` in prose | `Ciel`, `ciel` |
| `@hermes/*`, `hermes-tui`, `hermes-ink` npm workspaces | `@ciel/*`, `ciel-tui`, `ciel-ink` |

Protected — kept verbatim because they address real upstream resources:
`NousResearch/hermes-agent`, `lw-xiong/hermes-agent`, `hermes-agent.nousresearch.com`,
`docker pull nousresearch/hermes-agent`, and the third-party npm packages
`hermes-parser` / `hermes-estree`.

## Home and profile

`~/.ciel` is this fork's home. It is not a symlink to `~/.hermes`, and shares no sessions, memory
or config with the live install.

Migrating state later, each independently:

```
cp -a ~/.hermes/skills ~/.ciel/
cp -a ~/.hermes/memories ~/.ciel/
```

## Rules

1. New behaviour goes in `ciel/`, imported from one line in an upstream file.
2. Names are not cosmetics: if it says hermes, `scripts/cielify.py` carries a rule for it.
3. One commit per change, one-line why, so a conflicting commit can be dropped alone.
4. Anything generally useful goes upstream as a PR; the fork keeps only what is ours.

## Running it

```
ciel                      # interactive
ciel chat -q "one line"   # one-shot
ciel --version            # install dir + carried commits
```

Launcher `~/.local/bin/ciel` execs `.ciel/bin/ciel` in this repo.
