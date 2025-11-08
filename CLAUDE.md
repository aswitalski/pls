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

#### Spacing and layout

Consistent spacing creates breathing room and visual clarity:

- **Command spacing**: Every command starts with one line of space at the top
  and ends with one line of space at the bottom, creating clear separation from
  surrounding content.
- **Section separation**: Distinct sections within the interface have one line
  of space between them to create visual grouping.
- **Progressive display**: The command and output history is continually
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
- **Timeline-based layout**: The main interface maintains an array of component
  definitions representing the conversation timeline. Layout components render
  this array with consistent spacing, creating a natural scrollable flow where
  both historical and current interactions are visible.
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
