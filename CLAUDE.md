### About
A command-line concierge application that takes requests in natural language and performs described tasks. Users can ask politely using the `pls` command ("please") followed by comma-separated task descriptions and it will execute the requested operations showing progress and results in the terminal.

### Package info
- Package name: prompt-language-shell
- CLI command: pls
- License: ISC
- Status: Early stage - minimal placeholder implementation with colored welcome message

### Tech stack
- TypeScript (ES2024, ESNext modules)
- ES Modules (import/export syntax)
- Dependencies: chalk (terminal coloring), TypeScript, @types/node

### Commands
- npm run build: Compile TypeScript to dist/

### Code style
- Use ES modules (import/export) syntax, not CommonJS (require)
- Entry point at src/index.ts with #!/usr/bin/env node shebang
- Destructure imports when possible

### Configuration
- package.json: "type": "module" enables ESM support
- package.json: "bin": { "pls": "dist/index.js" } registers the CLI command
- package.json: "files": ["dist"] - only compiled code is published to npm
- tsconfig.json: Target ES2024, Module ESNext, output dist/ from src/
