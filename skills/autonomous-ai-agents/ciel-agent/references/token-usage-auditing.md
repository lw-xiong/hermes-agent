# Token Usage Auditing & Cost Tuning

How to measure actual Ciel token spend on an install and cut it, in order.

## Measure

```bash
ciel prompt-size                       # per-platform: prompt blocks + tool-schema sizes
```

Tool schemas are the single largest context block (each tool ~200 tokens; 25 tools
≈ 45 KB). Disabled toolsets disappear from it immediately.

## Actuals from state.db

Open read-only and aggregate in SQL, not by reading rows:

```python
import sqlite3
con = sqlite3.connect('file:<CIEL_HOME>/state.db?mode=ro', uri=True)
```

- **Per session**: `SELECT source, model, input_tokens, output_tokens, cache_read_tokens, api_call_count FROM sessions WHERE ended_at IS NULL`
- **Task breakdown (hidden cost)**: `SELECT task, SUM(api_call_count), SUM(input_tokens), SUM(output_tokens) FROM session_model_usage GROUP BY task` — shows `background_review`, `approval`, `compression`, `title_generation` spend separately from chat turns.
- **MCP ping counts**: `SELECT COUNT(*) FROM messages WHERE tool_name LIKE 'mcp_%'`
- **Output tok/s**: `SUM(output_tokens)` ÷ span of that session's assistant-message timestamps. Gaps BETWEEN consecutive assistant messages isolate generation bursts (3–15 s typical) from user think-time — do not read wall-clock span alone as generation speed.
- **Epoch timestamps**: `sessions.started_at` and `messages.timestamp` are unix epoch floats, NOT ISO strings. `datetime.fromisoformat` fails on them; wrap with `datetime.fromtimestamp`.

## Cut cost, biggest lever first

1. **Background review forks** — after every turn Ciel may spawn a second agent to decide what to store. `session_model_usage` usually shows it as the #1 non-chat consumer. Raise the nudges:
   ```bash
   ciel config set memory.nudge_interval 40            # default 10
   ciel config set skills.creation_nudge_interval 60   # default 15
   ```
2. **Trim unused toolsets** per platform (paid keys you don't hold, hardware that can't run them):
   ```bash
   ciel tools disable cli <toolset>
   ```
   Re-run `ciel prompt-size` to confirm the schema block shrank.
3. **`/new` at task boundaries** — gateway chats are one never-ending session; the forget→memory→session_search loop only fires across sessions, and `cache_read >> input_tokens` (often 30×+) is the re-billed conversation history every turn.
4. **Pin cheap models for side tasks** — `auxiliary.*.model`, per-cron-job model, `delegation.model` (children carry most tokens).

`cache_read >> input_tokens` is normal architecture, not a bug — every turn re-reads history. Only compression boundaries reset it.
