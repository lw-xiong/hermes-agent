# Ciel CLI Reference

Live sources when anything looks stale: `ciel --help`, `ciel <command> --help`,
https://hermes-agent.nousresearch.com/docs/reference/cli-commands

### Global Flags

```
ciel [flags] [command]        (no subcommand = interactive chat)

  --version, -V             Show version
  -z, --oneshot PROMPT      One-shot: print ONLY the final response (for scripts/pipes)
  -m MODEL  --provider P    Model/provider override for this invocation
  -t, --toolsets LIST       Comma-separated toolsets for this invocation
  --resume, -r SESSION      Resume session by ID or title
  --continue, -c [NAME]     Resume by name, or most recent session
  --worktree, -w            Isolated git worktree mode (parallel agents)
  --skills, -s SKILL        Preload skills (comma-separate or repeat)
  --profile, -p NAME        Use a named profile
  --yolo                    Skip dangerous command approval
  --tui / --cli             Force the Ink TUI / classic REPL
  --ignore-rules            Skip AGENTS.md/SOUL.md/memory/skill injection
  --safe-mode               Disable ALL customizations (troubleshooting)
  --pass-session-id         Include session ID in system prompt
```

### Chat

```
ciel chat [flags]
  -q, --query TEXT          Single query, non-interactive
  --image PATH              Attach a local image to a single query
  -Q, --quiet               Suppress banner, spinner, tool previews
  --checkpoints             Enable filesystem checkpoints (/rollback)
  --max-turns N             Cap tool-calling iterations
  --source TAG              Session source tag (default: cli)
```
(plus the global flags above)

### Configuration

```
ciel setup [section]      Wizard (model|tts|terminal|gateway|tools|agent)
ciel model                Interactive model/provider picker
ciel fallback [add|remove|list]  Fallback provider chain
ciel config [show|edit|get|set|unset|path|env-path|check|migrate]
ciel login / logout       OAuth sign-in / clear stored auth
ciel doctor [--fix]       Check dependencies and config
ciel status [--full]      Component summary (--full: every section)
```

### Tools & Skills

```
ciel tools [list|enable NAME|disable NAME]   Per-platform toolsets (curses UI with no args)

ciel skills list|browse|search QUERY|inspect ID
ciel skills install ID    Hub identifier OR a direct https://…/SKILL.md URL
ciel skills config        Enable/disable skills per platform
ciel skills check|update|uninstall|publish PATH
ciel skills tap add REPO  Add a GitHub repo as a skill source
ciel bundles              Skill bundles (one /<name> alias loads several skills)
```

### MCP Servers

```
ciel mcp add NAME (--url or --command) | remove | list | test NAME
ciel mcp catalog | install NAME     Curated catalog install
ciel mcp configure NAME             Toggle tool selection
ciel mcp serve                      Run Ciel as an MCP server
```
Details (transport, tool discovery, catalog): `references/native-mcp.md`.

### Gateway (Messaging Platforms)

```
ciel gateway run|install|start|stop|restart|status|setup
```

20+ platforms: Telegram, Discord, Slack, WhatsApp (Baileys + Business Cloud API), iMessage (Photon — `ciel photon setup`), Signal, Email, SMS, Matrix, Mattermost, Teams, LINE, SimpleX, ntfy, Google Chat, Home Assistant, DingTalk, Feishu, WeCom, Weixin, API Server, Webhooks. Open WebUI connects via the API Server adapter. Most adapters ship under `plugins/platforms/`.
Docs: https://hermes-agent.nousresearch.com/docs/user-guide/messaging/

### Sessions

```
ciel sessions list|browse|rename ID TITLE|delete ID|export OUT|prune|stats
```

### Cron / Webhooks

```
ciel cron list|create SCHED|edit ID|pause|resume|run ID|remove|status
    Schedules: '30m', 'every 2h', '0 9 * * *', ISO timestamp
ciel webhook subscribe NAME|list|remove NAME|test NAME
```
Webhook payloads/routes: `references/webhooks.md`.

### Profiles

```
ciel profile list|create NAME (--clone|--clone-all|--clone-from)|use|show|delete
ciel profile rename A B | alias NAME | export NAME | import FILE
ciel profile migrate-identity A B   Retry a completed rename's session/routing identity migration
```

### Credentials & Pools

```
ciel auth                 Interactive credential manager
ciel auth add [PROVIDER]  Add OAuth or API-key credential (nous, openai-codex, qwen-oauth, …)
ciel auth list|remove P IDX|reset PROVIDER|status
```
Multiple credentials per provider form a pool that rotates automatically and skips exhausted keys.

### Other

```
ciel desktop / gui        Native desktop app
ciel dashboard            Web admin panel + embedded chat (--stop / --status)
ciel proxy                OpenAI-compatible local proxy backed by an OAuth provider
ciel portal               Quick setup / sign in via Nous Portal
ciel kanban <verb>        Multi-agent work-queue board
ciel project              Named multi-folder workspaces
ciel skin list|use|set    Switch/tweak skins (see references/themes.md)
ciel pets <verb>          Pet mascots (see references/petdex.md)
ciel memory setup|status|off|reset   Memory provider
ciel secrets bitwarden|onepassword   External secret stores
ciel moa                  Mixture-of-Agents slots
ciel hooks / security / backup / import / checkpoints / console
ciel logs [-f] [errors]   View agent/error logs
ciel send                 One-off message through a gateway platform
ciel pairing / plugins / insights / journey / computer-use
ciel acp                  ACP server (IDE integration)
ciel completion bash|zsh|fish
ciel update / uninstall / claw migrate
```

Plugin- and provider-supplied subcommands (e.g. `ciel photon setup`) only appear once their plugin is installed/active.

### Where to Find Things

| Looking for... | Location |
|---|---|
| Config options | `ciel config edit` · [Configuration docs](https://hermes-agent.nousresearch.com/docs/user-guide/configuration) |
| Tools / toolsets | `ciel tools list` · [Tools reference](https://hermes-agent.nousresearch.com/docs/reference/tools-reference) |
| Skills catalog | `ciel skills browse` · [Skills catalog](https://hermes-agent.nousresearch.com/docs/reference/skills-catalog) |
| Provider setup | `ciel model` · [Providers guide](https://hermes-agent.nousresearch.com/docs/integrations/providers) |
| Env variables | `ciel config env-path` · [Env vars reference](https://hermes-agent.nousresearch.com/docs/reference/environment-variables) |
| Gateway logs | `~/.ciel/logs/gateway.log` (or `ciel logs`) |
| Sessions | `ciel sessions browse` (reads state.db) |
