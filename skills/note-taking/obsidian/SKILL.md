---
name: obsidian
description: Read, search, create, and edit notes in the Obsidian vault.
version: 1.2.0
author: Teknium (teknium1), Ciel
license: MIT
platforms: [linux, macos, windows]
metadata:
  ciel:
    tags: [Obsidian, Notes, Markdown, Vault]
    related_skills: []
---

# Obsidian Vault

Use this skill for filesystem-first Obsidian vault work: reading notes, listing notes, searching note files, creating notes, appending content, and adding wikilinks.

## Vault path

Use a known or resolved vault path before calling file tools.

The documented vault-path convention is the `OBSIDIAN_VAULT_PATH` environment variable, for example from `${CIEL_HOME:-~/.ciel}/.env`. If it is unset, use `~/Documents/Obsidian Vault`.

**On this machine the vault is `/media/hdd/Obsidian Vault/vault/`** (set in `~/.ciel/.env`).

## Obsidian app config lives ABOVE the wiki root

The Obsidian vault root on this machine is the parent folder `/media/hdd/Obsidian Vault/` — its `.obsidian/` (plugins, `graph.json`, `community-plugins.json`, `app.json`) sits ONE level above the DuckBrain wiki root `vault/`. Everything under `/media/hdd/Obsidian Vault` is one Obsidian vault; the DuckBrain schema is just the wiki subtree. When touching graph/settings/plugins, use `/media/hdd/Obsidian Vault/.obsidian/`.

**Never edit `.obsidian/graph.json` (or the plugin list) while Obsidian is running.** The app holds these in memory and re-saves its own copy over any file edit on quit or on any graph/settings change — a corrected on-disk file silently reverts. Graph color groups and plugin enablement only take effect after a FULL quit and relaunch of Obsidian, not a window close. Recipe: `references/graph-and-plugins.md`.

## This machine's vault layout (DuckBrain schema)

```
vault/
├── HermesAgent/        Hermes Agent's WRITABLE home — the whole wiki graph moved here
│   ├── wiki/
│   ├── index.md   MOC hub (all pages)
│   ├── tags.md    generated tag index
│   │   ├── MEMORY.md, USER.md   hot memory (~/.ciel/memories symlinks here)
│   │   ├── entities/  User lwx, Host Legion5, Hermes Agent, DuckBrain, Obsidian Vault
│   │   ├── concepts/  Two-Layer Memory, Knowledge Graph, Lazy Engineering
│   │   ├── sources/   DuckBrain README, DuckBrain Substack
│   │   └── synthesis/ Environment Snapshot, Vault Bootstrap
│   └── daily/         YYYY-MM-DD.md — agent journal
└── ClaudeCode/    full access since 2026-10-19 (was read-only until then)
```

There is no longer a `vault/wiki/` — the wiki root is `vault/HermesAgent/wiki/`. When the user restructures the vault, verify the current layout with a directory listing before assuming a remembered path; a stale path silently audits the wrong subtree.

## Write boundary (standing rule, set by the user)

`HermesAgent/` (its `wiki/` graph + `daily/`) is Hermes Agent's home — this includes the main wiki (see layout above; the old rule saying "main wiki is read-only" predates that move and is superseded). **Full vault access granted 2026-10-19 by the user, `ClaudeCode/` included** — this supersedes the earlier per-edit rule. Destructive or irreversible vault edits (deleting a note, bulk rewrites) are still confirmed first. Read freely across the whole vault. Record any boundary change in memory, in this section, and in the workspace hub so it survives a session change. (Local edit to a shipped skill: `ciel update` restores the old per-edit text — re-apply the change afterwards.)

**This vault is a DuckBrain graph.** Access it with the `mcp_duckbrain_vault_*` MCP tools (registered in `~/.ciel/config.yaml`):
- `mcp_duckbrain_vault_info` — vault stats (pages by kind, tags)
- `mcp_duckbrain_vault_search` — BM25 full-text search
- `mcp_duckbrain_vault_read` — read by title or filepath
- `mcp_duckbrain_vault_write` — create a wiki page or append to today's daily note
- `mcp_duckbrain_vault_context` — daily notes + keyword search in one call

Prefer these tools over raw file edits for vault work. Fall back to `read_file`/`write_file`/`patch` only for bulk edits the MCP tools don't cover (e.g. renaming, multi-file link fixes).

## Vault color law (standing user convention)

The user defines node colors semantically, not by folder. Apply this law in `.obsidian/graph.json` and in any graph plugin config:

| Color | Meaning |
|---|---|
| Red | memory and todos |
| Blue | system (index, tags, generated pages) |
| Purple | information regarding the user (entities, user/hot-memory notes, daily journal) |
| Green | personality and concepts |
| Pink | capabilities (tools, sources, references) |
| Teal | agent territory — one color per agent subtree |

This law overrides the temptation to color by `item-type`. Implement it with `path:` groups ordered specific-before-general (first match wins). Correct decimal `rgb` values for the named colors — convert deliberately and verify, because a hand-picked decimal can land on a different hue than the name implies (`0x00FFFF` is cyan, not teal):

```
red #FF0000=16711680  blue #0000FF=255        purple #800080=8388736
green #008000=32768  pink #FFC0CB=16761035   teal   #008080=32896
```

Recipe and ordering rules: `references/graph-and-plugins.md`.

Apply the law with the table's EXACT decimal values above — do not invent new decimals, because a plausible-looking number lands on a different hue than the name implies (`65535` is cyan, not teal; `16733695` is magenta, not pink). When the user says "write this as law for each of the agents," it is not enough to set `graph.json`: also add the six-line law to each agent's own docs (its hub, INDEX, README, or instructions file) so the agents carry the convention forward, not just the graph config.

Every wiki page needs frontmatter `title`, `item-type` (entity|concept|source|synthesis), `tags`, `created`, `updated`, `last_verified`. Tags must be inline arrays (`tags: [a, b, c]`), not YAML block lists — the health checker's `yaml.safe_load` parser handles both, but inline arrays are the vault convention. Keep filenames = page titles — short human-readable names (`Local LLM.md`, `Gateway Architecture.md`), not long kebab-case slugs (`sub-4gb-vram-inference-architecture.md`); the user can't fetch what they can't remember. Keep every wikilink resolving to a real page (no dead links). Dead-link check:

```bash
VAULT="/media/hdd/Obsidian Vault/vault/HermesAgent/wiki"; python3 -c "import re,pathlib as P;n={p.stem for p in P.Path('$VAULT').rglob('*.md')};print([(str(p),t) for p in P.Path('$VAULT').rglob('*.md') for t in re.findall(r'\[\[([^\]]+)\]\]',p.read_text()) if t.split('|')[0].strip() not in n])"
```

## Optimizing the graph

When the user asks to optimize or clean up the graph, audit before editing. `scripts/graph_audit.py <wiki-path>` (optionally `--regen-tags --exclude DIR ...`) prints every page with inbound/outgoing link counts, dead links, and orphans, and regenerates `tags.md` from frontmatter. Point it at the wiki subtree (`vault/HermesAgent/wiki`), not the vault root. Standard pass:

1. Run the audit; confirm the MOC hub (`index.md`) links every neuron and dead links are zero.
2. Merge near-duplicate nodes: two concepts covering the same ground split signal across them. Fold the weaker page into the stronger as a `##` subsection, then repoint every inbound link — `index.md`, the layout page, synthesis pages, daily notes.
3. Delete the merged page; regenerate `tags.md`.
4. Re-run the audit: 0 dead links, 0 orphans (the infrastructure files `index`/`log`/`tags`/`MEMORY`/`USER` are not neurons and stay unlinked), no duplicated concept.
5. Leave an unresolved `[[Link]]` only when the user explicitly wants another agent to create that page — say which link is the intentional seed.

Pitfalls:
- Page filenames contain spaces, so a shell `for f in $(find ...)` loop word-splits them and every grep inside fails. Do graph math in Python or `find -print0`, never in a word-split shell loop.
- A historical mention of a merged-away page ("merged X into Y") still reads as a dead link; write the old name as plain text, not a wikilink.
- **Connection info in markdown tables is invisible to the graph.** Obsidian draws an edge only from a real `[[wikilink]]`. An agent (or a template) that records relationships in a `| Source | Target | Weight |` table produces zero edges no matter how many rows it has. Convert the table's name cells to `[[wikilinks]]` and strip per-edge wikilinks only when collapsing those edge files. Verify with an outbound-degree count per node — `out=0` on a fully populated node is the tell.
- **One file per edge is bloat.** Synapse/edge files that duplicate links already recorded in their nodes' tables add ~50 lines each and nothing to retrieval. Collapse them into the owning nodes and delete the generators, or a later run silently recreates them.
- The user dislikes scattered top-level files: a lone `README.md` gets folded into the `INDEX.md`/MOC hub as sections, and an orphan `log.md` whose entries duplicate the daily journal and a synthesis page is deleted outright. Do not leave either "flying around" next to the graph.
- Non-wiki folders inside the vault (e.g. an external agent's workspace dir) are invisible to DuckBrain but still pollute Obsidian's own search and graph view — keep tool artifacts (node_modules, caches, build output) out of the vault tree. Any agent or tool launched with its working directory inside the vault scaffolds `node_modules/` into that cwd on install, so after any session that touched the vault run `du -sh` on it and delete the artifacts before auditing. Exclude those dirs from link math too — a bare `rglob('*.md')` counts the agent's own files and its dependency READMEs as vault pages and reports phantom dead links.
- **YAML frontmatter must be at line 1.** Obsidian ignores frontmatter that starts mid-file; patching `---` in after existing content produces a file with no recognized frontmatter at all. When adding frontmatter to a page that already has content, insert `---` / fields / `---` as the very first lines, before any heading or text.
- **`graph_audit.py --regen-tags` rewrites `tags.md` and strips its frontmatter.** After running it, re-add the `title/item-type/tags/created/updated/last_verified` block to `tags.md` (and to `MEMORY.md`, `USER.md`, `log.md` if they were touched) — these infrastructure pages are not neurons but the typed-memory convention still requires frontmatter on every wiki page.
- **Never use `patch` with `replace_all=true` on a non-unique pattern.** A pattern like `- messages: N` appears once per session entry; `replace_all` rewrites every occurrence and corrupts message counts (e.g. `27` becomes `2`, `Related` text gets a digit appended). Anchor on unique surrounding context instead.
- **Orphan daily notes (out=0) fail the Knowledge Graph rule that every note links out.** Fix by appending `Related: [[index]] · [[Two-Layer Memory]]` at the end of each daily file — one `Related` block per file, not `replace_all` across all of them.

When the user delegates a vault subtree to another agent ("let it build its own"), seed the empty directory structure and do not populate it. Creating the content yourself defeats the delegation and buries the agent's own output. The same applies in reverse: never migrate or rewrite an agent's folder on its behalf. When auditing that subtree, distinguish the agent's own in-progress files from vault pages — the other agent's dangling links are its own work to finish, not defects for you to fix. Do not pass paths containing `$OBSIDIAN_VAULT_PATH` to `read_file`, `write_file`, `patch`, or `search_files`; resolve the vault path first and pass a concrete absolute path. Vault paths may contain spaces, which is another reason to prefer file tools over shell commands.

## Interconnecting multiple agent graphs — a judgment call, not a default

When the user asks to connect every agent's notes into one network, first decide whether linking is a net win. Interconnecting is right when each subtree carries real, non-redundant knowledge. It is wrong when one subtree is mostly scaffolding, test fixtures, or a restatement of the main graph in different vocabulary — the cross-links then pollute the main graph's Obsidian search, "related notes", and graph view, while DuckBrain never even reads that subtree (it indexes only `wiki/` + `daily/`). Evaluate each subtree on three questions before adding a single link:

1. **Is it reachable?** If the retrieval layer does not index that folder, its notes cannot be recalled at runtime — they are an island that only adds graph noise.
2. **Is it redundant?** If a page restates an existing node (e.g. an agent's "linked notes" pattern vs. your own Knowledge Graph concept), linking it duplicates signal.
3. **Does it add cost?** Extra files are crawled by Obsidian search and embeddings regardless of DuckBrain's scope.

If the answers say the subtree is low-value, say so and offer to separate the graphs instead of linking them — link-level separation inside one vault, not a filesystem split (DuckBrain already scopes its indexing). Procedure: `Separating co-located graphs` below. Only when linking is justified, proceed:

1. Map each graph with `scripts/graph_audit.py <path>` (excluding the others) to confirm each is internally sound. An agent's own network is usually already complete and self-interconnected; the gap is almost always the links *between* subtrees, which are zero.
2. Find the natural bridge page in each graph — the page about the shared substrate (the vault itself) or the shared principle (the knowledge-graph concept) — and add a `## Sibling agents` section listing the other agents' hubs by vault-relative path.
3. Fill only an empty hub the other agent declared but never wrote, matching its exact schema by reading a sibling file of the same kind (frontmatter keys, section layout, bidirectional convention). Never restructure its populated files, and leave its own dangling refs for its engine to fix.
4. Verify every bridge you added resolves — build a `filename → path` map across all subtrees and check each new `[[target]]` against it. A bridge to a nonexistent page is worse than no bridge. Remember that resolution is by basename vault-wide, so a bridge whose name collides with a page in another subtree is not the bridge you intended.
5. Color-code by territory with `path:` groups so each agent reads as one cluster; the ordering rule (first match wins — specific before general) is in `references/graph-and-plugins.md`.

Pitfalls:
- The same filename can exist in two subtrees — an agent may keep both a top-level hub (`OpenCode.md`) and a same-named file inside its own tree (`neurons/concepts/OpenCode.md`), only one of which is empty. Scope `os.walk`/glob to the exact absolute path and confirm with `wc -l <abs path>` before concluding a file is empty or that another process rewrote it.
- Prefer `scripts/graph_audit.py` over ad-hoc `\[\[([^\]]+)\]\]` extraction: literal `` `[[ ]]` `` in prose (a note explaining what a wikilink is) matches a naive regex and reports phantom dead links, while the script filters empty targets.

If the vault path is unknown, `terminal` is acceptable for resolving `OBSIDIAN_VAULT_PATH` or checking whether the fallback path exists. Once the path is known, switch back to file tools.

## Separating co-located graphs (link-level, not filesystem)

When the user says to separate the agent graphs, the split is at the **link** level inside the one vault — never a filesystem split, since DuckBrain already scopes its indexing and a move is churn with no gain.

1. Enumerate every cross-graph edge before touching anything: grep each territory for `[[` targets that resolve in a *different* territory. Convert them to plain text (`[[OpenCode]]` → `OpenCode`) rather than deleting the sentence — the prose stays readable, the edge is gone.
2. Rewrite any section that *described* the interconnection. A heading like "Sibling agents" or "Cross-Graph Synapses" left in place reads as a broken promise; restate it as "each self-contained, no cross-graph edges by design" so no future reader thinks the links were dropped by accident.
3. **Verify the way Obsidian actually resolves links — vault-wide by filename, not per territory.** Build ONE map of `filename → path` across the whole vault, then flag any `[[link]]` whose resolved file lives in a different territory. A per-territory name-set is a broken check: it treats same-named files in two subtrees as independent and reports `cross-graph=0` while Obsidian is still drawing the edge. Also list duplicate filenames vault-wide — see the ambiguity pitfall below.
4. **When the user wants a shared concept available to both sides, copy it — do not link it.** Give each graph its own file (its own frontmatter, its own "Related" links pointing at local nodes), register the copy in that graph's own INDEX/hub, and delete the mention in the original. A copied page usually imports `[[User lwx]]` or another shared-entity link; that is still a cross-graph edge, so also create a minimal local entity node in the receiving graph and repoint the copy's links at it — and give the copy a UNIQUE basename, since a same-named file keeps the edge alive through filename ambiguity. Re-run the vault-wide check from step 3 until every territory reports `cross-graph=0`.
5. Expect to be asked twice, and check duplicate filenames FIRST. When the user says a link survives, check for two files with the same basename in different subtrees before re-scanning for bracketed links — filename ambiguity is the usual cause and it is invisible to a per-territory scan and to a grep for `[[Name]]` (the surviving "link" may not even be bracketed). Grep for the specific entity names they mention and confirm zero remain before reporting done.
6. **Do not answer a separation request with a menu of options.** When the user states what they want done, do it and report the result; a clarification card here reads as stalling. Ask only when the instruction is genuinely ambiguous about *what the artifact is for*, not about *how* to execute it.

Pitfalls:
- **A duplicate filename IS a cross-graph edge.** Obsidian resolves `[[Note Name]]` by basename across the entire vault, so two files named `User lwx.md` in different subtrees make every `[[User lwx]]` ambiguous — it may resolve into the other agent's graph even though no bracketed link crosses territories. Copying a shared concept into another graph therefore requires renaming the copy to a unique basename (and repointing its links), not just giving it its own frontmatter. Duplicate basenames within a single subtree cause the same ambiguity internally and deserve the same rename.
- Plain prose naming another agent ("expected from agents (Hermes Agent, OpenCode)") creates no edge at all. When the user reports a surviving link, distinguish a real `[[wikilink]]` from a bare mention before editing — and say which it is rather than silently deleting the word.
- **Do not claim two agents are "the same model" or otherwise assume an unverified premise about another agent's setup.** Read its config (`opencode.jsonc`, model field) and report what it actually says — an unpinned config means the default, not what you assume. Flag unverifiable premises as unverified instead of building an argument on them.

When the user says to kill the harmful parts of another agent's folder and keep the useful parts, follow `references/agent-subtree-pruning.md`. The short version: dependency-scan before deleting, delete the generators so removed files cannot be recreated, strip every dangling reference left behind, and update that subtree's self-description files (hub, INDEX, README) to describe the pruned structure honestly. Salvage any genuinely unique idea into the main graph first, or it is lost with the deletion.

## When the user says they did it manually

Do not defend the earlier work or re-argue the design — audit it. List every file, check the hub exists and links every neuron, run the dead-link/orphan check, and report what is missing or inconsistent as a concrete list. Typical post-migration defects: the hub file deleted or replaced by a copy of an older MOC with stale framing and a duplicated section, dangling links to pages that no longer resolve, stray lock/scratch files left in `wiki/`, and a boundary or convention rule that survived in one file but not in the hub. Report findings and ask before fixing anything inside a folder you do not own.

## Vault write rules (standing — from Vault Growth Rules + Decision Log Protocol)

Applies to EVERY vault write, no reminder needed. Frontmatter, filename, and dead-link rules are in "Vault color law" above; the rest:

1. **Two-step save.** File the note, then link it from `index.md` in the same session — no dead ends, no index bloat.
2. **`index.md` is pointer-only.** One line per page, budget ~200 lines / 25KB, never content.
3. **Merge on sight.** Never save a near-duplicate — fold twins/synonyms into one page and repoint inbound links.
4. **Staleness is first-class.** Absolute dates in prose; bump `updated:` on edit; caveat old claims ("as of 2026-10-19, unverified since …").
5. **Never index tool artifacts or third-party trees.** Prose placeholders go in backticks, not `[[wikilinks]]`.
6. **Consolidation after any write burst:** dedupe, wikilink, register in `index.md`, then run `python3 ~/.ciel/skills/note-taking/obsidian/scripts/graph_audit.py "/media/hdd/Obsidian Vault/vault/HermesAgent/wiki"` (`--regen-tags` rebuilds `tags.md`). 0 dead links, 0 orphans when done.

**Decision log:** newest at top, format `- [D1] FINAL 2026-10-19 — one-line decision. Why: … Rejected: A (reason); B (reason)`. Status = FINAL / TENTATIVE / SUPERSEDED by D#. Superseded decisions are never deleted, only pointed at. Log into the `daily/` note under `## Decisions` or the entity/concept page concerned; `MEMORY.md` holds pointers only. A brainstormed idea is not a decision until chosen — keep facts, assumptions, and recommendations separate.

## Read a note

Use `read_file` with the resolved absolute path to the note. Prefer this over `cat` because it provides line numbers and pagination.

## List notes

Use `search_files` with `target: "files"` and the resolved vault path. Prefer this over `find` or `ls`.

- To list all markdown notes, use `pattern: "*.md"` under the vault path.
- To list a subfolder, search under that subfolder's absolute path.

## Search

Use `search_files` for both filename and content searches. Prefer this over `grep`, `find`, or `ls`.

- For filenames, use `search_files` with `target: "files"` and a filename `pattern`.
- For note contents, use `search_files` with `target: "content"`, the content regex as `pattern`, and `file_glob: "*.md"` when you want to restrict matches to markdown notes.

## Create a note

Use `write_file` with the resolved absolute path and the full markdown content. Prefer this over shell heredocs or `echo` because it avoids shell quoting issues and returns structured results.

## Append to a note

Prefer a native file-tool workflow when it is not awkward:

- Read the target note with `read_file`.
- Use `patch` for an anchored append when there is stable context, such as adding a section after an existing heading or appending before a known trailing block.
- Use `write_file` when rewriting the whole note is clearer than constructing a fragile patch.

For an anchored append with `patch`, replace the anchor with the anchor plus the new content.

For a simple append with no stable context, `terminal` is acceptable if it is the clearest safe option.

## Targeted edits

Use `patch` for focused note changes when the current content gives you stable context. Prefer this over shell text rewriting.

## Wikilinks

Obsidian links notes with `[[Note Name]]` syntax. When creating notes, use these to link related content.
