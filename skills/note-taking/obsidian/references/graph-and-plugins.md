# Graph coloring + plugin installs (Obsidian)

## Graph color groups

Groups live in `.obsidian/graph.json` under `colorGroups`:

```json
{ "query": "[\"item-type\":\"entity\"]", "color": { "a": 1, "rgb": 4336041 }, "label": "Entities" }
```

- `rgb` is the decimal integer of the hex color (`0x4229A9` → 4336041). Convert deliberately and verify: a hand-picked decimal often lands on a different hue than the name implies (`0x00FFFF` is cyan, not teal). Correct values for the user's color law (see SKILL.md):
  ```
  red #FF0000=16711680   blue #0000FF=255        purple #800080=8388736
  green #008000=32768    pink #FFC0CB=16761035   teal   #008080=32896
  ```
- Group queries use **core Search syntax**. Property queries MUST be the bracket form `["property":"value"]`; the bare `property:value` form matches nothing and silently colors zero nodes.
- `item-type` frontmatter values on this vault: entity, concept, source, synthesis. Nodes auto-color if notes carry the property.

## Path groups beat tag groups for territory coloring

To color by vault region, use `path:` queries instead of one group per tag:

```json
{ "query": "path:HermesAgent",  "color": { "a": 1, "rgb": 15965202 } }
{ "query": "path:wiki/concepts", "color": { "a": 1, "rgb": 7649791 } }
```

- **Obsidian applies the FIRST matching group and ignores the rest.** Order specific before general (`path:wiki/concepts` before `path:wiki`), or the general rule swallows every note under it. This is the usual reason a color group appears to do nothing.
- A vault that grew one tag group per tag ends up with dozens of overlapping rules where ordering decides everything. Replace the array with ~6-9 territory groups rather than adding a 61st rule; name rules by region so a future reader can tell which folder a color belongs to.
- Build the new array with a script (`json.load` → replace `colorGroups` → `json.dump(indent=2)`); a hand-written string patch of a 600-line file will not match.

## Editing graph.json while the app is running

`write_file`/`patch` refuse the file when its mtime moved since your last read, because Obsidian rewrote it mid-session. That is expected, not a conflict: re-read it (it differs from your copy by a byte or two) and edit with a script rather than a full-file overwrite, which would discard the app's in-memory state. Back the file up first (`cp graph.json graph.json.bak`), keep every unrelated key (`scale`, `centerStrength`, physics) by loading and re-dumping the parsed object, and validate with `json.load` after writing. Confirm the count changed (`len(colorGroups)`), since Obsidian may immediately re-save its copy over yours.

## Why a file edit can look like it did nothing

Obsidian holds graph settings in memory and overwrites the file on quit/change. Sequence that fails: write corrected `graph.json` → user restarts → Obsidian re-saves its stale in-memory copy (new mtime, old queries). The plugin list (`community-plugins.json`) behaves the same. File edits only stick if Obsidian is fully closed at write time and NOT reopened before the change is needed; prefer in-app changes or a graph plugin that colors live without touching `graph.json`.

## Installing a community plugin from release bundles (no app interaction)

1. Check the id/repo in the official registry: `curl -s https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugins.json`.
2. Download into `.obsidian/plugins/<id>/`:
   ```
   https://github.com/<owner>/<repo>/releases/latest/download/{main.js,mainifest.json,styles.css}
   ```
   Verify `main.js` got HTTP 200 and is non-empty; other two may 404 for plugins without styles.
3. Append `"<id>"` to `.obsidian/community-plugins.json` (read it first — the write guard requires a fresh read).
4. Fully quit and relaunch Obsidian. Restricted mode cannot be pre-disabled from files (it lives in the app's localStorage) — the user must turn off community plugins once in Settings.

## Graph-color plugins that work without graph.json

| id | repo | behavior |
|---|---|---|
| auto-tag-graph-colors | trisko06/auto-tag-graph-colors | colors nodes by their tags |
| graph-color-propagation | tacitustus/obsidian-graph-color-propagation | propagates color along links from source nodes |
| graph-styler | moonweave/obsidian-graph-styler | per-node custom colors via settings |
| graph-source-color | karl-cn/graph-source-color | color by incoming-link source |
| graph-insight | n23eos/advanced_graph_view | advanced graph: filter/group by property or tag |
