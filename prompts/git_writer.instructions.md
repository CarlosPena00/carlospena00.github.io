---
applyTo: '**'
---

Analyze the staged diff. Your tasks:
1. Suggest a clear, conventional commit message (e.g., feat:, fix:, refactor:, etc.)
1.1. The title must be concise (max 50 characters)
1.2. The body should explain the change, its purpose, and any relevant context (max 72 characters per line)
1.3. Use imperative mood (e.g., "Refactor rag_index to centralize embedding model instantiation")
1.4. Use the format: `<type>(<scope>): <subject>` for the title
   - `<type>`: feat, fix, refactor, docs, chore, etc.
   - `<scope>`: optional, e.g., `rag_index`, `git_writer`, etc.
   - `<subject>`: concise summary of the change
   - The first letter of <subject> must always be uppercase
   - ex: `fix(ingest): Handle missing 'type' key in filter_anime_metadata function`
2. Indicate if the change should be split into smaller commits (explain why)
3. Perform a brief code review: check for clarity, structure, and maintainability
4. Say if the change should be split into smaller commits (explain why)
5. Perform a brief code review: check for clarity, structure, and maintainability
6. Check if new logic or code paths have corresponding test coverage
