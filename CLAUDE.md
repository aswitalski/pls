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
- Dependencies: chalk (terminal coloring)
- Dev dependencies: TypeScript, @types/node, vitest

### Commands
- npm run build: Compile TypeScript to dist/
- npm run dev: Compile TypeScript in watch mode (auto-recompile on file changes)
- npm run test: Run tests once
- npm run test:watch: Run tests in watch mode

### Code style
- Use ES modules (import/export) syntax, not CommonJS (require)
- Entry point at src/index.ts with #!/usr/bin/env node shebang
- Destructure imports when possible
- Test naming: Use present tense without "should" (e.g., "parses single task" not "should parse single task")

### Configuration
- package.json: "type": "module" enables ESM support
- package.json: "bin": { "pls": "dist/index.js" } registers the CLI command
- package.json: "files": ["dist"] - only compiled code is published to npm
- tsconfig.json: Target ES2023, Module ESNext, output dist/ from src/
- vitest.config.ts: Test configuration with node environment
