# Relocating Ciel Home (or just skills/memory) to Another Disk

Ciel resolves its state directories at runtime from the profile home, so a **symlink** or a **`CIEL_HOME` change** relocates them cleanly. Nothing in the skills or memory subsystem hardcodes an absolute home path.

## What resolves from where

- `skills/`   → `get_ciel_home() / "skills"` (loading AND creation)
- `memories/` → `get_ciel_home() / "memories"` (`MEMORY.md` / `USER.md`)
- `config.yaml`, `.env`, `state.db`, `sessions/`, `cron/`, `logs/`, `auth.json` → all under `get_ciel_home()`
- `get_ciel_home()` honors `$CIEL_HOME` (default `~/.ciel`). Profiles use `~/.ciel/profiles/<name>/`.

**Size the problem before moving anything** — moving only skills/memory rarely fixes a full disk:
```bash
du -sh ~/.ciel/* | sort -h   # the bulk is tools/, installs/, cache/, ciel-agent/ source
```
Skills + memory are typically a few tens of MB; `tools/`+`installs/`+`cache/`+`ciel-agent/` are gigabytes. Say this plainly instead of implying a skills/memory move will free meaningful space.

## Option A — symlink skills and memories only

```bash
mkdir -p /target/ciel/skills /target/ciel/memories
mv ~/.ciel/skills/*   /target/ciel/skills/
mv ~/.ciel/memories/* /target/ciel/memories/ 2>/dev/null   # may be empty
rmdir ~/.ciel/skills ~/.ciel/memories
ln -s /target/ciel/skills   ~/.ciel/skills
ln -s /target/ciel/memories ~/.ciel/memories
```
Writes through the symlink land on the target disk: `skill_manage` and the memory tool both write to `get_ciel_home()/skills`|`/memories`, which follows the link.

## Option B — relocate the whole home

Stop the gateway first so nothing holds the SQLite WAL or the `.lock` files, then copy, swap, symlink, restart:
```bash
systemctl --user stop ciel-gateway
cp -a ~/.ciel /target/ciel
mv ~/.ciel ~/.ciel.bak        # keep until verified
ln -s /target/ciel ~/.ciel
systemctl --user start ciel-gateway
```
Keep `.ciel.bak` until a session starts cleanly, then delete it. A "rotational disk slows session start" tradeoff applies to Option B only (source + tools move too).

Permanent, symlink-free alternative: export `CIEL_HOME=/target/ciel` in whatever launches Ciel, and add `Environment=CIEL_HOME=/target/ciel` to the gateway's systemd unit.

## Pitfall: `skills.external_dirs` is READ-ONLY — never use it to relocate skills

External dirs are read-only by design: local skills take precedence on name collision, and **skill creation always writes to `get_ciel_home()/skills/`**. Use `external_dirs` to *share* skills across agents/tools, never to make skill writes land on another disk. For writable relocation, use a symlink or `CIEL_HOME`.

Also: `skills.external_dirs` has **no `ciel config set` support** — edit it directly in `config.yaml` (expands `~` and `${VAR}`).

## Verify after moving

```bash
readlink -f ~/.ciel/skills ~/.ciel/memories   # both must resolve onto the target disk
ciel doctor
```
Restart any running gateway/desktop/CLI session so it re-resolves paths. An fstab entry with `defaults` auto-mounts at boot, so the symlink survives reboots; a non-fstab/manual mount does not — verify before promising persistence.