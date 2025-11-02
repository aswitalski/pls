### About

A command-line concierge application that takes requests in natural language
and performs described tasks. Users can ask politely using the `pls` command
("please") followed by comma-separated task descriptions and it will execute
the requested operations showing progress and results in the terminal.

### Look and feel

The terminal UI should be polished, intuitive, and visually appealing, drawing
heavy inspiration from Claude Code's design language. All visual components
should follow these principles:

- **Color scheme**: Use a carefully selected palette that enhances readability
  and provides clear visual hierarchy. Primary actions in green, warnings in
  yellow, errors in red, secondary information in muted colors.
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

### Development

When the user explicitly requests a quality check, run the following commands
in sequence:

1. **Build**: Verify TypeScript compilation succeeds
2. **Format**: Apply consistent code formatting
3. **Lint**: Check for code quality issues
4. **Test**: Ensure all tests pass

Do not run this verification workflow automatically after every change. Only
run it when the user specifically asks for it. This sequence catches issues
early and maintains codebase health. For smaller changes during active
development, the development mode provides automatic recompilation in watch
mode.

### Code style

- Use ES modules (import/export) syntax, not CommonJS (require)
- Entry point at src/index.tsx with #!/usr/bin/env node shebang
- Use .tsx extension for files with JSX, .ts for plain TypeScript
- Destructure imports when possible
- Import grouping: Sort imports into groups separated by empty lines:
  1. Libraries (react, ink, etc.)
  2. Utils and helpers
  3. Services
  4. UI components
- Test naming: Use present tense without "should" (e.g., "parses single task"
  not "should parse single task")
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
