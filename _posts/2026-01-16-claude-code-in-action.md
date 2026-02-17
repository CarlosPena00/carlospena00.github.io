---
layout: post
title: "LLM: Claude Code in Action - Notes"
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

### Example: Automatically Run Sqlmesh Format After Sql Code Edits

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "(Edit|Write).*\\.sql",
        "hooks": [
          {
            "type": "command",
            "command": "uv run sqlmesh format",
            "timeout": 30,
            "description": "Auto-format SQLMesh models and tests after editing"
          }
        ]
      }
    ]
  }
}

``` 

### Example: Automatically Run Ruff After Python Code Edits

You can automate code formatting and linting with Ruff after every code edit by configuring a post-edit hook in Claude.

#### 1. Add a PostToolUse Hook in `.claude/settings.json`

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/run-ruff.sh"
          }
        ]
      }
    ]
  }
}
```

#### 2. Create the `run-ruff.sh` Script

> **Note:** Claude does not display logs, echo, or errors from hooks. For debugging, write output to a file (e.g., using `echo` or `tee`).

```js
#!/bin/bash
input=$(cat)
file_path=$(echo "$input" | jq -r '.tool_input.file_path' 2>/dev/null)

# Only proceed if the file exists and is a Python file
if [[ -z "$file_path" || ! -f "$file_path" || "$file_path" != *.py ]]; then
  exit 0
fi

uv run ruff check --fix --unsafe-fixes "$file_path"
uv run ruff format "$file_path"
exit 0
```

**Tips:**
- Make sure `jq`, `uv`, and `ruff` are installed and available in your environment.
- Grant execute permission to the script: `chmod +x .claude/hooks/run-ruff.sh`
- For debugging, add lines like `echo "$file_path" >> /tmp/ruff_hook.log`.

This setup ensures your Python files are automatically linted and formatted after each edit, keeping your codebase clean and consistent.

---

## 11) Other hook event types

Besides `PreToolUse` and `PostToolUse`, you can hook into:

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

---

# Extra

## 13) Claude Skills

- Personal  ~/.claude/skills/<skill-name>/SKILL.md  All your projects
- Project   .claude/skills/<skill-name>/SKILL.md    This project only

ex: Git Writter


```bash
# /.claude/skills/git-writter/SKILL.md
# git-writer

A skill to check the git staged area and write a conventional commit message.

## Instructions

<git-writer>

### Step 1: Analyze the staged changes

Run these commands in parallel to gather context:

1. `git diff --cached --stat` - Get a summary of staged changes
2. `git diff --cached` - Get the full diff of staged changes
3. `git log --oneline -5` - See recent commit style for consistency

### Step 2: Determine the commit type

Based on the staged changes, select the appropriate type:

- `feat`: new feature
- `fix`: bug fix
- `docs`: documentation only
- `style`: formatting (no code change)
- `refactor`: code change that neither fixes a bug nor adds a feature
- `perf`: performance improvement
- `test`: add/update tests
- `build`: build system/deps changes
- `ci`: CI configuration changes
- `chore`: maintenance tasks
- `revert`: revert a previous commit

### Step 3: Write the commit message

Follow this format exactly:

<type>(<scope>): <short, imperative description>

[body]

---
How to test

[explicit, reproducible steps or N/A]

[optional footer(s)]


**Rules:**
- Title must be **clear and short** (aim for **<= 72 chars**)
- Use **imperative** mood ("add", "fix", "remove")
- If you use a scope, keep it short (e.g. `ui`, `core`, `deps`)
- For breaking changes: Add `!` after type/scope: `feat!: ...` or `feat(api)!: ...`
- The "How to test" section should be explicit and reproducible with copy/paste-ready steps
- If testing is not applicable, write `N/A`
- The first letter of the short description should be Capital

### Step 4: Present the commit message

Show the proposed commit message to the user and ask if they want to:
1. Commit with this message
2. Edit the message
3. Cancel

### Step 5: Execute the commit (if approved)

If the user approves, create the commit using:

git commit -m "$(cat <<'EOF'
<commit message here>
EOF
)"


</git-writer>
```
