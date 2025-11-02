### About

A command-line concierge application that takes requests in natural language and performs described tasks. Users can ask politely using the `pls` command ("please") followed by comma-separated task descriptions and it will execute the requested operations showing progress and results in the terminal.

### Package info

- Package name: prompt-language-shell
- CLI command: pls
- License: ISC
- Status: Early stage - minimal placeholder implementation with colored welcome message

### Tech stack

- TypeScript (ES2023, ESNext modules)
- ES Modules (import/export syntax)
- Testing: vitest
- Code formatting: Prettier
- Dependencies: chalk (terminal coloring)
- Dev dependencies: TypeScript, @types/node, vitest, prettier

### Commands

- npm run build: Compile TypeScript to dist/
- npm run dev: Compile TypeScript in watch mode (auto-recompile on file changes)
- npm run test: Run tests once
- npm run test:watch: Run tests in watch mode
- npm run format: Format all files with Prettier
- npm run format:check: Check if files are formatted correctly

### Code style

- Use ES modules (import/export) syntax, not CommonJS (require)
- Entry point at src/index.ts with #!/usr/bin/env node shebang
- Destructure imports when possible
- Test naming: Use present tense without "should" (e.g., "parses single task" not "should parse single task")
- Prettier formatting: 80 chars, semicolons, single quotes, trailing commas (es5, multi-line only), always arrow parens, 2 space indent

### Configuration

- package.json: "type": "module" enables ESM support
- package.json: "bin": { "pls": "dist/index.js" } registers the CLI command
- package.json: "files": ["dist"] - only compiled code is published to npm
- tsconfig.json: Target ES2023, Module ESNext, output dist/ from src/
- vitest.config.ts: Test configuration with node environment
- .prettierrc: Formatting rules
- .prettierignore: Excludes node_modules, dist, package-lock.json
