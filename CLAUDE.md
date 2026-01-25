### About

A command-line concierge that receives tasks in natural language via the `pls`
command and executes them with careful planning. Tasks are logical, sequential,
and atomic.

**Capabilities:** Filesystem operations, resource fetching, shell commands,
information retrieval, multi-step task orchestration.

**Text Processing:** All text transformation and generation MUST be done by the
LLM via the system prompt. The application only sends raw data and displays
results as returned.

### Look and feel

Terminal UI inspired by Claude Code's design language:

- **Colors**: Green for primary actions, yellow for warnings, red for errors,
  muted for secondary info. Concierge output in white, user input with gray
  chevron prefix ("> Yes").
- **Progress**: Spinners, progress bars, status indicators for long operations.
- **Layout**: Clean structured output with proper spacing and visual separators.
- **Spacing**: One blank line before/after commands, one line between sections.
  Timeline is appended continuously, never cleared. Parent components control
  layout; children don't add outer spacing.

### Architecture

Small, focused modules with single responsibilities. TypeScript interfaces
enforce contracts. Prefer functional patterns (pure functions, immutability).
Use dependency injection for testability and swappable implementations.

**Tool System:** Tool registry pattern in `tool-registry.ts`. Each tool has a
schema (Anthropic SDK definition) and instruction file (markdown in
`src/config/`, copied to `dist/config/` at build). Instruction file conventions:
- Natural language descriptions, not JSON
- User-facing messages in lowercase
- Generic abstract examples to avoid biasing LLM toward documentation patterns

**Interface:** Component-based with composition. Stateless components render
once; stateful components track interaction. Queue-based execution processes
components sequentially. Timeline maintains conversation history.

#### Skills System

Users extend functionality via markdown files in `~/.pls/skills/`. Skills
describe operations, parameters, and steps. Loaded dynamically at runtime.

**Skill sections:**
- **Name** (required): Unique identifier, used for `[Skill Name]` references
- **Description** (required): Purpose, variants, conditions
- **Aliases** (optional): Example commands that invoke this skill
- **Config** (optional): YAML structure for required properties (stored in
  `~/.plsrc`). Supports nested paths: `product.alpha.path`
- **Steps** (required): Human-readable workflow steps
- **Execution** (optional): Actual commands. Syntaxes:
  - Direct: `python3 ./script.py --flag`
  - Labeled: `Run: npm install`
  - Skill reference: `[Other Skill Name]`

**Placeholders:**
- Strict `{section.variant.property}`: Direct config lookup
- Variant `{section.VARIANT.property}`: LLM matches variant from user intent,
  then strict lookup

**Config validation:** Missing config properties trigger a CONFIGURE task that
prompts user before execution proceeds.

**Example:** `pls process alpha` → SCHEDULE matches skill → extracts variant
"alpha" → expands `[Navigate To Product]` → resolves `{product.VARIANT.path}`
→ checks config → prompts if missing → executes with resolved values.

### Development

Quality check workflow (run only when explicitly requested):
1. Build → 2. Format → 3. Lint → 4. Test → 5. Document

**Testing:** Focus on practical scenarios and real-world usage. Avoid
over-testing trivial paths. Use `safeRemoveDirectory` from `tests/test-utils.ts`
for cleanup.

**Commits:** Run `npm run format` before committing. Suggest 4 message options.
Messages: imperative mood, 40-60 chars, no period, single line only, no
metadata. Check `git log --oneline -16` to match style.

**File renames (case-only):** Use two-step rename via temp file for macOS
compatibility.

### Code style

- ES modules, `.tsx` for JSX, `.ts` for plain TypeScript
- Entry point: `src/index.tsx` with `#!/usr/bin/env node`
- **Imports**: Group by: 1) Libraries 2) Types 3) Services 4) UI components.
  Alphabetize within groups.
- **Constants**: camelCase for app/module vars, UPPER_CASE for env/static values
- **Control flow**: Early returns and guard clauses to reduce nesting
- **Test naming**: Natural language in `describe`/`it` blocks, present tense
- **Messages**: PascalCase for dictionary keys, camelCase for generator
  functions
- **Prettier**: 80 chars, semicolons, single quotes, trailing commas (es5),
  2-space indent
- **Markdown**: 80 char hard limit, wrap at word boundaries, two-space indent
  for list continuations

### Tech stack

TypeScript (ES2023, Node16), React, ink (terminal UI), vitest, Prettier, ESLint

### Commands

- `npm run build`: Compile TypeScript
- `npm run dev`: Watch mode compilation
- `npm run test` / `test:watch`: Run tests
- `npm run format` / `format:check`: Prettier
- `npm run lint` / `lint:fix`: ESLint

### Package info

- Name: prompt-language-shell
- CLI: `pls`
- License: ISC
- Status: Early stage with ink-based terminal UI
