### About

A professional command-line concierge that users can fully trust with their
tasks and requests. Like a reliable personal assistant, it receives errands,
commands, or tasks in natural language and executes them with careful planning
and attention to detail.

Users interact with the tool using the `pls` command ("please") followed by
their request. The concierge plans and executes tasks that are logical,
sequential, and atomic, ensuring each step is performed as expected.

#### Capabilities

The concierge can handle a wide range of operations:

- Filesystem operations: creating, reading, updating, deleting files and
  directories
- Resource fetching: downloading files, accessing web content, retrieving data
  from APIs
- System integration: executing shell commands, invoking system utilities,
  using OS-provided scripting interfaces
- Information retrieval: answering questions, explaining concepts, providing
  documentation
- Task orchestration: planning multi-step workflows, coordinating dependent
  operations, managing complex sequences

#### Philosophy

The tool embodies the principles of a trusted professional concierge:

- Reliability: Tasks are executed exactly as requested, with consistent and
  predictable behavior
- Intelligence: Natural language requests are understood and translated into
  well-planned action sequences
- Transparency: Progress is communicated clearly, showing what is being done,
  what succeeded, and what failed
- Professionalism: Operations are performed efficiently, safely, and with
  appropriate error handling

#### Audience

While particularly valuable for developers who need to automate command-line
workflows, the tool is designed for anyone comfortable with terminal interfaces
who wants to delegate tasks using natural language rather than memorizing
specific commands and syntax.

#### Text Processing

**IMPORTANT**: Do not process text locally in the application code. All text
transformation, formatting, and generation MUST be done by the LLM via the
system prompt. The application should only send raw information to the LLM and
display the results as returned. This ensures consistency and leverages the
LLM's natural language capabilities.

### Look and feel

The terminal UI should be polished, intuitive, and visually appealing, drawing
heavy inspiration from Claude Code's design language. All visual components
should follow these principles:

- **Color scheme**: Use a carefully selected palette that enhances readability
  and provides clear visual hierarchy. Primary actions in green, warnings in
  yellow, errors in red, secondary information in muted colors.
- **Timeline colors**: In the conversation timeline, concierge output appears
  in white (default terminal color), while user prompts and choices appear with
  a gray chevron prefix (e.g., "> Yes") to visually distinguish user actions
  from system responses.
- **Progress indication**: Show clear, real-time feedback for long-running
  operations using spinners, progress bars, or status indicators similar to
  Claude Code's approach.
- **Results presentation**: Display output in a clean, structured format with
  proper spacing, indentation, and visual separators. Use boxes and borders
  thoughtfully to group related information.
- **Interactive elements**: When appropriate, provide interactive components
  (selections, confirmations) that feel responsive and intuitive.
- **Typography and spacing**: Maintain consistent padding, margins, and line
  spacing throughout. Avoid visual clutter - every element should have a clear
  purpose and breathing room.
- **Status and feedback**: Always communicate what the application is doing,
  what succeeded, what failed, and what comes next. Make the user feel informed
  and in control.

The goal is to create a terminal experience that feels modern, professional,
and enjoyable to use - matching the quality users expect from Claude Code.

#### Spacing and layout

Consistent spacing creates breathing room and visual clarity:

- **Command spacing**: Every command starts with one line of space at the top
  and ends with one line of space at the bottom, creating clear separation from
  surrounding content.
- **Section separation**: Distinct sections within the interface have one line
  of space between them to create visual grouping.
- **Progressive display**: The command and output timeline is continually
  appended, never cleared. Users see everything they've entered and all
  responses in a continuous, scrollable timeline.
- **Component responsibility**: Individual components don't add their own outer
  spacing. Parent components control the layout, ensuring consistent spacing
  throughout the interface.

These spacing principles keep the interface clean, scannable, and easy to
follow during long interactive sessions.

### Implementation

Follow software engineering best practices to create a maintainable,
testable, and extensible codebase:

- **Modularity and responsibility**: Create small, focused modules with single
  responsibilities. Each module should do one thing well. Follow principles
  from popular libraries like React (component composition), Express (middleware
  pattern), and modern TypeScript codebases.
- **Clear APIs and contracts**: Define explicit interfaces for all services,
  component props, and function arguments. Establish clear contracts and
  protocols between modules. Use TypeScript's type system to enforce these
  contracts at compile time.
- **Incremental development**: Implement new features by degrees, in small,
  manageable steps. Each step should leave the codebase in a working state.
  Avoid large, monolithic changes.
- **Reusability**: Design components and utilities to be reusable across
  different contexts. Avoid tight coupling and hard-coded dependencies.
- **Functional approach**: Prefer functional programming patterns when
  appropriate - pure functions, immutability, composition. This improves
  testability and reduces side effects.
- **Natural language naming**: Use descriptive, natural language names for
  variables, functions, components, and modules. Code should read like prose
  where possible. Avoid cryptic abbreviations or overly technical jargon when
  clearer alternatives exist.
- **Testability**: Design every component to be easily testable in isolation,
  in cooperation with other components, or both. Use dependency injection and
  composition to facilitate testing.
- **Mockable external dependencies**: All REST calls, external API operations,
  shell invocations, and AI interactions must be abstracted behind interfaces
  that can be easily mocked. Tests should not depend on varying external
  factors like network availability or non-deterministic AI responses.
- **Swappable implementations**: Use dependency injection and interface-based
  design to make implementations swappable. For example, different AI providers,
  storage backends, or shell executors should be interchangeable without
  modifying dependent code.
- **Architectural patterns**: Respect industry-standard design patterns where
  appropriate - client-server for API communication, peer-to-peer for direct
  module interaction, observer for event handling, strategy for algorithm
  variation, factory for object creation, etc.
- **Learning from the best**: Study and adopt design choices from well-regarded
  libraries and frameworks. If a pattern works well in Claude Code, React,
  Express, or similar tools, consider applying it here.

The goal is to build a codebase that is easy to understand, extend, test, and
maintain - both now and in the future.

#### Tool System Architecture

The application uses a tool registry pattern to manage AI-powered capabilities.
Each tool has a schema (Anthropic SDK tool definition with input validation)
and instruction file path containing the AI prompt. Tools register in
`tool-registry.ts` as singletons. Instruction files (markdown in `src/config/`)
are copied to `dist/config/` during build. This separation keeps prompts
maintainable and allows dynamic loading at runtime.

**Instruction file conventions:**
- Use natural language descriptions in examples, not JSON snippets
- Focus on explaining the expected behavior and output structure
- Keep examples concise and readable for human understanding
- Show all user-facing messages and prompts in lowercase to match the
  conversational, casual tone of the interface

#### Skills System

Users extend the application with domain-specific workflows through skills.
Skills are markdown files stored in `~/.pls/skills/` that describe operations,
parameters, and steps. The skills service loads them dynamically at runtime and
concatenates their content into tool instructions as an "Available Skills"
section. This allows users to teach the app about project-specific commands
without modifying code. Missing skills directory fails gracefully.

##### Skill Definition Format

Skills follow a structured markdown format providing deterministic execution
despite LLM indeterminism. Each skill file contains these sections:

**Name** (required, ### heading)
- Unique identifier for the skill
- Used for skill references in Execution sections: `[Skill Name]`
- Must match exactly for skill cross-references

**Description** (required, ### heading)
- Explains the skill's purpose for humans and LLM
- Documents variants, conditions, and special cases
- Guides LLM on when to skip optional steps
- Example: "Generation script only needed for major changes"

**Aliases** (optional, ### heading)
- Bullet list of example commands that invoke this skill
- Helps LLM recognize skill from natural language
- Example: "navigate to product", "go to project directory"

**Config** (optional, ### heading)
- YAML structure defining required configuration properties
- Nested format using indentation (standard YAML)
- Properties specify TypeScript types: string, boolean, number
- Example:
  ```yaml
  product:
    alpha:
      path: string
      enabled: boolean
    beta:
      path: string
      enabled: boolean
  ```
- Generates config paths in dot notation: `product.alpha.path`,
  `product.beta.enabled`
- Values stored in user's `~/.plsrc` file

**Steps** (required, ### heading)
- Bullet list describing logical workflow steps
- Human-readable, may contain placeholder references
- Must have same number of items as Execution section (if present)
- Used for LLM understanding and user documentation

**Execution** (optional but recommended, ### heading)
- Bullet list of actual commands to execute
- Each line becomes one task in execution plan
- Must have same number of items as Steps section
- Supports three syntaxes:
  1. Direct commands: `python3 ./script.py --flag`
  2. Labeled commands: `Run: npm install`
  3. Skill references: `[Other Skill Name]`
- Supports two placeholder types:
  1. Strict: `{section.variant.property}` - direct config lookup
  2. Variant: `{section.VARIANT.property}` - LLM matches variant from user
     intent

**Parameter Placeholder Resolution:**

Strict placeholders (all lowercase path components):
- Format: `{product.alpha.path}`
- Resolution: Direct lookup in ~/.plsrc at path `product.alpha.path`
- Deterministic: No LLM interpretation
- Use when variant is known or single-variant configs

Variant placeholders (uppercase VARIANT keyword):
- Format: `{product.VARIANT.path}`
- Resolution: Two-phase process
  1. Planning: LLM matches user intent ("alpha", "variant A") to variant name
     (`alpha`)
  2. Execution: Strict config lookup at resolved path (`product.alpha.path`)
- Controlled indeterminism: LLM picks variant, then deterministic lookup
- Use when skill supports multiple variants and user specifies which one

**Skill Reference Resolution:**

Format: `[Skill Name]` in Execution section
- Example: `[Navigate To Product]`
- Planning phase: Recursively load referenced skill's execution steps
- Inject steps inline at reference position
- Enables composition of complex workflows from simple skills
- Circular reference detection required
- Referenced skill's config requirements inherited

**Config Validation Workflow:**

When skill is matched during planning:
1. Extract all config paths from Execution section
2. Recursively expand skill references
3. Replace VARIANT with LLM-matched variant name
4. Check if required properties exist in ~/.plsrc
5. If missing: Insert CONFIG task before execution tasks
6. CONFIG task prompts for all missing properties
7. User provides values, saved to ~/.plsrc
8. Execution proceeds with fully resolved config

**Example Workflow:** User runs `pls process alpha`

1. PLAN matches "process" to "Process Product" skill
2. PLAN extracts "alpha" and matches to variant `alpha`
3. Process execution line: `[Navigate To Product]`
   - Expand to: `operation {product.VARIANT.path}`
   - Replace VARIANT with `alpha`: `operation {product.alpha.path}`
   - Check config: Does `product.alpha.path` exist in ~/.plsrc?
4. If missing: Create CONFIG task
   - Prompt: "Product Alpha path"
   - User enters: `/data/projects/alpha`
   - Save to ~/.plsrc
5. Execute: `operation /data/projects/alpha`
6. Execute remaining commands

This design achieves determinism through layering:
- Layer 1 (LLM): Match natural language to skills and variants
- Layer 2 (Structured): Execute exact commands with strict config lookup
- Layer 3 (Validation): Enforce required config before execution

#### Component Lifecycle

The interface operates like a conversation timeline, where components represent
turns in a dialogue between the user and the concierge. Components flow through
distinct lifecycle stages, from planning to active execution to completed
history.

**Lifecycle Stages:**

Components progress through four stages:
- **Awaiting**: Queued, waiting for their turn
- **Active**: Currently executing, receiving user input
- **Pending**: Parked and visible, awaiting user confirmation or next action
- **Done**: Finished and archived in the timeline

**Flow Concept:**

The lifecycle follows a natural conversation pattern:

1. **Queue to Active**: Components wait their turn in a queue. When ready, one
   becomes active - the current focus of interaction.

2. **Active to Timeline**: After finishing their execution, components either
   move to the permanent timeline or remain in pending state:
   - Simple display components (messages, feedback) finish immediately and move
     straight to timeline
   - Interactive components (plan, confirmation, configuration) may be held as
     pending while awaiting subsequent actions
   - Failed or cancelled components move directly to timeline with appropriate
     feedback

3. **Context Preservation**: Some interactions benefit from seeing previous
   context. For example, when confirming a plan, the plan waits in pending
   state - visible so users know what they're approving. Once the user confirms
   or cancels, both the plan and the confirmation decision move to timeline
   together in logical order.

4. **Timeline Order**: The timeline preserves the logical sequence of
   interaction. When related components complete together, they're archived in
   the order that tells the clearest story - for instance, a plan appears
   before the user's decision to proceed.

**Component Types:**

- **Stateless**: Display-only components that render once and complete
  immediately (messages, feedback, status displays)
- **Stateful**: Interactive components that track user interaction and maintain
  state across their lifecycle (plan selection, confirmation prompts,
  configuration wizards)

**Design Principles:**

- Progressive disclosure: Only one interactive component is active at a time,
  keeping the interface focused
- Context awareness: Components can be parked in pending state to provide
  context for subsequent interactions
- Timeline integrity: Archived components preserve their final state in the
  timeline, creating an accurate interaction history
- Clean separation: Queue (future), active/pending (present), and timeline
  (past) are distinct areas with clear transitions between them

### Interface

The interface architecture emphasizes composition, reusability, and separation
of concerns. Components are designed as single-purpose, generic modules that
can be composed together to create more complex screens. This approach keeps
individual components simple, testable, and reusable across different contexts.
Rather than creating monolithic, application-specific components, the system
builds up functionality through composition of smaller, focused pieces. The
goal is to create a library of generic building blocks that can be combined in
various ways, making the interface flexible and maintainable.

The application uses a component-based architecture with these key principles:

- **Component composition**: Complex screens are built by composing simple,
  single-purpose components. Each component has one clear responsibility and
  can be reused or replaced independently. Internal components within a file
  can be used to further break down functionality into focused pieces.
- **Generic, reusable building blocks**: Layout components (vertical stacking,
  bordered containers), input components (multi-step forms), and display
  components (recursive lists, task displays) are designed to be generic and
  configurable rather than application-specific. They accept props that control
  their behavior and appearance, making them suitable for different use cases
  across the application.
- **Clean component rendering**: A single component wrapper provides a clean
  entry point for rendering any component definition. It uses straightforward
  switch logic and proper destructuring rather than complex conditional syntax,
  making the code easy to read and maintain.
- **Queue-based execution**: The main interface uses a queue to manage
  component execution flow. Components are processed sequentially - stateless
  components auto-complete and move to the timeline immediately, while stateful
  components wait for user interaction or async operations before completing.
- **Timeline-based layout**: The main interface maintains an array of component
  definitions representing the conversation timeline. Layout components render
  this array with consistent spacing, creating a natural scrollable flow where
  both completed and current interactions are visible.
- **Type-safe component definitions**: Each component has a strongly-typed
  definition that describes its name, props, and optional state. TypeScript's
  discriminated unions ensure type safety when working with different component
  types.
- **Stateless and stateful components**: Some components are stateless and only
  need props to render. Others track internal state to manage their lifecycle.
  Component definitions handle both patterns cleanly through optional state
  fields.
- **Separation of state and props**: Configuration data (props) is kept
  separate from runtime state. This makes it easier to snapshot what a
  component looked like when it completed, and allows components to be reusable
  in different contexts.
- **Children as composition mechanism**: Components accept children props,
  enabling flexible composition. This allows dynamic content to be passed in
  from the outside rather than being hardcoded within the component,
  facilitating the composition of nested structures.

These design choices make the interface code easier to understand, safer to
modify, and simpler to extend with new features.

### Development

When the user explicitly requests a quality check, run the following commands
in sequence:

1. **Build**: Verify TypeScript compilation succeeds
2. **Format**: Apply consistent code formatting
3. **Lint**: Check for code quality issues
4. **Test**: Ensure all tests pass
5. **Document**: Supplement documentation with essential information

Do not run this verification workflow automatically after every change. Only
run it when the user specifically asks for it. This sequence catches issues
early and maintains codebase health. For smaller changes during active
development, the development mode provides automatic recompilation in watch
mode.

#### Testing philosophy

Tests should focus on practical scenarios: parsing, rendering, formatting, and
handling real data. Test what matters in production, not exhaustive edge cases.
Write tests that validate real-world usage patterns and catch regressions in
actual workflows. Avoid over-testing trivial code paths or theoretical scenarios
that don't occur in practice.

When significant changes, refactoring, or new features are implemented, ask
whether tests are needed to cover the new functionality. Tests should:

- Cover real-life use cases and scenarios that users will actually encounter
- Validate the behavior that matters for production use
- Avoid testing edge cases that would never happen in practice
- Focus on catching actual bugs rather than achieving coverage metrics

#### Commit messages

Before creating a commit, ensure code quality:

1. **Organize imports**: Ensure all imports follow the import organization rules
   (libraries, types, services, UI components - each group alphabetically
   sorted)
2. **Format code**: ALWAYS run `npm run format` before committing to apply
   consistent formatting across all files. This is mandatory and prevents
   formatting-related changes from cluttering future commits.
3. **Update tests**: Ensure that tests were added or amended to align with
   changes in the code. All tests must pass before committing.

When asked to commit changes, suggest 4 different commit message options that
follow the guidelines below. Present them clearly so the user can choose which
one best describes the changes. After the user selects, proceed with the
commit.

Follow these guidelines for clear, professional commit messages:

- **Imperative mood**: Write as commands that complete "If applied, this commit
  will [your message]"
- **Short and focused**: Aim for up to 40 characters, max 60 characters
- **No period**: Don't end the subject line with a period
- **Lowercase after verb**: Start with capital letter, use lowercase for the
  rest unless proper nouns
- **Natural language**: Use clear, natural language that describes what the
  change does. Avoid excessive technical jargon unless it's the clearest way to
  express the change. Write for humans, not machines.
- **Check recent commits**: Before creating a commit message, run `git log
  --oneline -16` to see recent commits and match the style and format
  consistently.
- **Single line only**: Use ONLY the subject line with NO body, NO additional
  lines, NO bullet points, NO explanations. The commit message must be exactly
  one line describing what the commit does.
- **No metadata**: Do NOT add metadata like "Generated with Claude Code".
  The commit message is ALWAYS the single-line subject.

Examples:
- `Execute planned tasks`
- `Generate execution reports`
- `Answer information requests`
- `Enable skill sharing`
- `Support workspace configs`
- `Add interactive clarifications`

#### File renames

When renaming files where only the letter case changes (e.g., `feedback.test.tsx`
→ `Feedback.test.tsx`), use a two-step rename process to ensure compatibility
with case-insensitive filesystems like macOS:

```bash
git mv tests/feedback.test.tsx tests/feedback-temp.test.tsx
git mv tests/feedback-temp.test.tsx tests/Feedback.test.tsx
```

This approach ensures:
- Git properly tracks the case change in its internal tree
- The rename works correctly when others checkout the commit on both
  case-sensitive (Linux) and case-insensitive (macOS) filesystems
- No conflicts or issues for developers who checked out previous versions

For regular renames (different names, not just case), a simple `git mv` is
sufficient.

### Code style

- Use ES modules (import/export) syntax, not CommonJS (require)
- Entry point at src/index.tsx with #!/usr/bin/env node shebang
- Use .tsx extension for files with JSX, .ts for plain TypeScript
- Import organization: Follow these rules for clean, maintainable imports:
  - Group imports into sections separated by empty lines:
    1. Libraries (Node built-ins, external packages like react, ink, etc.)
    2. Types (TypeScript type imports)
    3. Services and helpers (local services, utilities, helpers)
    4. UI components (local UI components)
  - Within each group, sort imports alphabetically
  - Use single import statements for multiple items from the same source
  - Avoid unused imports
  - Destructure imports when possible
- Constant naming: Follow these conventions for const declarations:
  - App-level variables: camelCase (e.g., `apiClient`, `defaultConfig`)
  - Module-level config: camelCase (e.g., `minRetries`, `baseUrl`)
  - Env/configuration constants: UPPER_CASE (e.g., `API_KEY`, `MAX_TIMEOUT`)
  - Math, static values, sentinel values: UPPER_CASE (e.g.,
    `MIN_PROCESSING_TIME`, `BUILT_IN_CAPABILITIES`, `MAX_RETRIES`)
- Control flow: Reduce nesting by using early returns and guard clauses.
  Prefer returning early when conditions aren't met rather than wrapping the
  entire function body in an if statement. This keeps code flat, readable, and
  easier to follow. Apply this pattern systematically:
  - Start with guard clauses that return early for edge cases or preconditions
  - Handle special cases next, each with their own early return
  - Place the main/default logic at the end without additional nesting
  - Avoid if-else chains; use early returns to handle each case independently
- Test naming: Follow these conventions for clear, readable tests:
  - Use natural language in all `describe` blocks (e.g., "Parsing commands"
    not "parseCommands", "Loading skills" not "loadSkills")
  - Use natural language in all `it` blocks with present tense, starting with
    lowercase (e.g., "parses single task" not "should parse single task")
  - Test file naming: Component-specific tests should match the component name
    (e.g., `Command.test.tsx` for testing `Command.tsx`)
  - Service/utility tests should use descriptive names (e.g., `config.test.ts`
    for testing configuration service)
- Test utilities: For tests that create temporary directories, always use
  `safeRemoveDirectory` from `tests/test-utils.ts` for cleanup. This utility
  handles intermittent ENOTEMPTY errors by retrying operations and gracefully
  handling failures. Never use `rmSync` directly in test cleanup.
- Message dictionaries: Use PascalCase for keys in message dictionaries (e.g.,
  `FeedbackMessages.ConfigurationComplete`, `FeedbackMessages.UnexpectedError`)
  while using camelCase for message generator functions (e.g.,
  `getCancellationMessage()`, `getRefiningMessage()`). This convention
  distinguishes static message constants from dynamic message generators.
- Example messages: In documentation and instruction files, user messages
  typically appear in lowercase (e.g., "list your skills", "show apple stock")
  reflecting natural command-line usage, while concierge responses use standard
  sentence capitalization (e.g., "Here are my capabilities:", "I've cancelled
  the execution").
- Prettier formatting: 80 chars, semicolons, single quotes, trailing commas
  (es5, multi-line only), always arrow parens, 2 space indent
- ESLint rules: Strict TypeScript rules, console allowed, unused vars warn
  (allow if prefixed with an underscore)
- Markdown formatting: Max 80 chars per line, wrap naturally at word
  boundaries. For list items that exceed 80 chars, continue on next line with
  two-space indent to align with the list item content.

### Tech stack

- TypeScript (ES2023, Node16 modules)
- ES Modules (import/export syntax)
- React with JSX/TSX
- Terminal UI: ink (React renderer for CLI)
- Testing: vitest
- Code formatting: Prettier
- Linting: ESLint with strict TypeScript rules
- Dependencies: react, ink
- Dev dependencies: TypeScript, vitest, prettier, eslint, typescript-eslint,
  @types/node, @types/react

### Package info

- Package name: prompt-language-shell
- CLI command: pls
- License: ISC
- Status: Early stage - minimal placeholder implementation with ink-based
  terminal UI

### Commands

- npm run build: Compile TypeScript to dist/
- npm run dev: Compile TypeScript in watch mode (auto-recompile on file
  changes)
- npm run test: Run tests once
- npm run test:watch: Run tests in watch mode
- npm run format: Format all files with Prettier
- npm run format:check: Check if files are formatted correctly
- npm run lint: Lint all files with ESLint
- npm run lint:fix: Lint and auto-fix issues where possible

### Configuration

- package.json: "type": "module" enables ESM support
- package.json: "bin": { "pls": "dist/index.js" } registers the CLI command
- package.json: "files": ["dist"] - only compiled code is published to npm
- tsconfig.json: Target ES2023, Module Node16, moduleResolution node16,
  JSX react-jsx, output dist/ from src/
- tsconfig.eslint.json: Extended config for linting (includes tests and config
  files)
- vitest.config.ts: Test configuration with node environment
- .prettierrc: Formatting rules
- .prettierignore: Excludes node_modules, dist, package-lock.json
- eslint.config.js: Strict TypeScript linting rules with type-checking
- There is an unnecessary empty line before the message (the first line replacing the loading message)
and there should be one empty line between the list and the message).
List built-in skills in blue and user-specified ones in green.