---
layout: post
title: "Claude Code in Action - Notes"
author: Carlos Pena
date: 2026-01-17
---

Reference: [Claude Code in Action](https://anthropic.skilljar.com/claude-code-in-action)

## 1) `CLAUDE.md` (3 types)

Claude Code can read **instructions from `CLAUDE.md`** at different scopes:

### ✅ Global (User-level)
- Applies across **all projects** on your machine.
- Use for your personal preferences:
  - coding style
  - tone
  - tooling habits
  - security defaults

### ✅ Project (General)
- Applies to the **entire repository/project**.
- Use for:
  - architecture overview
  - team conventions
  - shared workflows

### ✅ Local (Project-local / personal)
- Applies only in your **local environment**, not meant to be shared.
- Use for:
  - machine-specific paths
  - local dev quirks
  - personal shortcuts



## 2) Referencing files with `@filename` / `@path`

Use `@` to explicitly reference a file or path in prompts.

Example:
- `@src/db/schema.py`
- `@docs/architecture.md`
- `@package.json`

This is useful to:
- anchor Claude on the correct source of truth
- avoid hallucinating structure
- speed up navigation



## 3) "Set comment in memory" (sticky instructions)

You can write a note inside your instructions that Claude should remember and reuse.

Example:
```js
# The database schema is defined in the @path/to/file.py file. Reference it anytime.
```

This pattern is great for:
- “single source of truth” references
- rules like “always run tests before committing”
- reminders about environment assumptions



## 4) Images: copy/paste support

Claude Code supports **copy-pasting images** directly into the conversation.

Useful for:
- UI screenshots
- error dialogs
- diagrams / architecture drawings
- broken layouts / CSS bugs



## 5) Thinking Mode (deeper reasoning)

You can trigger deeper reasoning by adding explicit thinking tags/phrases like:

- `Think`
- `think more`
- `think a lot`
- `think longer`
- `ultrathink`

Example prompt:
```txt
This is a tough task — ultrathink about the best approach and tradeoffs.
```

Notes:
- Works well together with **planning mode**
- Best for debugging, refactors, system design, or tricky edge cases



## 6) Context management shortcuts

### If Claude makes a mistake
- Press `Esc` and add a correction into memory/instructions.

### Rewind conversation
- Press `Esc` **twice** to rewind.

### Compact context
- Use:
```txt
/compact
```
This compresses the current conversation so you can keep working with a cleaner context window.



## 7) Custom commands (`.claude/commands/`)

You can create reusable “commands” inside:

```js
.claude/commands/<command_name>.md
```

### Example: `audit.md`
```js
You goal is to update any vulnerable dependencies.
- Check lockfiles
- Upgrade safely
- Ensure builds/tests still pass
- Summarize changes + risks
```

### Example: `write_tests.md`
```js
Write comprehensive tests for: $ARGUMENT
- Follow project test conventions
- Prefer integration tests where useful
- Cover edge cases
- Include setup/teardown notes
```

Use cases:
- repeatable workflows
- consistent team automation
- faster execution for common tasks



## 8) MCP Servers (tools integration)

MCP servers let Claude use external tools safely (browser, filesystem, automation, etc).

### Example: Playwright MCP Server
Playwright MCP allows Claude to:
- open a browser
- navigate pages
- click elements
- run UI flows

Add it via CLI:
```js
claude mcp add playwright npx ...
```

You can also allow/configure MCP in:
- `settings.local.json`



## 9) GitHub integrations

Enable Claude GitHub integration:
```txt
/install-github-app
```

### Common capabilities
**A) Mention Claude**
- In an issue/PR comment:
  - `@claude`
  - “run the codebase”
  - “complete the task”
  - “respond with a fix + explanation”

**B) Pull Request actions**
Claude can:
- create PRs
- run checks
- review PRs
- generate reports/summaries

### Workflow configuration (`.github/workflows/claude.yml`)

You can define project setup steps, like:

```yaml
- name: Project Setup
  run: |
    npm run setup
    npm run dev:daemon
```

Add custom instructions (environment assumptions):
```yaml
custom_instructions: |
  The project is already set up with all dependencies installed.
  The server is already running at localhost:3000.
  Logs are being written to logs.txt.
  If needed, you can query the db with the 'sqlite3' CLI.
  If needed, use the mcp__playwright toolset to interact with the app.
```

Example MCP config block:
```yaml
mcp_config: |
  {
    "mcpServers": {
      "playwright": {
        "command": "npx",
        "args": [
          "@playwright/mcp@latest",
          "--allowed-origins",
          "localhost:3000;cdn.tailwindcss.com;esm.sh"
        ]
      }
    }
  }
```

Example allow-list of tools:
```yaml
allowed_tools: "Bash(npm:*),Bash(sqlite3:*),mcp__playwright__browser_snapshot,mcp__playwright__browser_click,..."
```



## 10) Hooks (automation before/after actions)

Hooks let you run scripts **before or after** Claude uses tools.

You can set hooks:
- globally
- per project
- per project-local

Manage via:
```txt
/hooks
```
(or manually editing config files)

### Example: `PreToolUse`
Runs **before** a tool executes.
- Can **block** tool execution.
- Uses exit codes:
  - `0` → OK / allow
  - `2` → Error (PreToolUse: block)

Tool names you can hook into:
- `read`
- `edit`
- `multiEdit`
- `write`
- `bash`
- `WebFetch`
- `Grep`
- `glob`
- etc.

### Security best practices for hooks (Must-do)
- validate + sanitize inputs
- quote shell variables: `"$VAR"`
- block path traversal like `..`
- prefer absolute paths
- skip sensitive files:
  - `.env`
  - `.git/`
  - secrets/config vault files

### Example use case
- PreToolUse checks for duplicated code before allowing edits (avoid repeated logic)

---

## 11) Other hook event types

Besides `PreToolUse`, you can hook into:

- **Notification**
  - runs when Claude needs permission to use a tool
  - or after being idle for 60 seconds
- **Stop**
  - when Claude finishes responding
- **SubagentStop**
  - when a subagent task finishes
- **PreCompact**
  - before compact runs (manual or automatic)
- **UserPromptSubmit**
  - when user submits a prompt (before Claude processes)
- **SessionStart**
  - when starting/resuming a session
- **SessionEnd**
  - when a session ends

---

## 12) Claude Code SDK (CLI / TypeScript / Python)

Claude Code SDK supports automation from:
- CLI
- TypeScript
- Python

- Default behavior is **read-only** for safety.
- Useful for batch analysis, automation, or integrating Claude Code into your workflows.

Example (async):
```python
from claude_code_sdk import query

async for message in query("look for duplicate queries"):
    print(message)
```

Example (sync):
```python
import asyncio
from claude_code_sdk import query

async def main():
    async for message in query("look for duplicate queries"):
        print(message)

asyncio.run(main())
```
