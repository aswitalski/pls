# Tests

Unit and integration tests for the `pls` command-line tool.

## Structure

```
tests/
├── components/          # UI component tests
│   ├── controllers/     # Component controller logic
│   └── views/           # Component rendering
├── configuration/       # Config system tests
├── execution/           # Task execution tests
├── flows/               # End-to-end workflow tests
├── integration/         # System integration tests
├── services/            # Service layer tests
├── types/               # Type validation tests
├── fixtures/            # Test data
├── shell/               # Shell execution tests (excluded)
├── tools/               # LLM tool tests (excluded)
├── test-utils.ts        # Shared utilities
├── Main.test.tsx        # Main component tests
└── README.md
```

## Commands

```bash
npm test              # Run all tests (excludes shell/ and tools/)
npm run test:watch    # Watch mode
npm run test:llm      # Run LLM-dependent tests (requires API key)
npm run test:shell    # Run shell execution tests
```

## Excluded Tests

Some tests are excluded from the default test run:

- `tests/tools/` - Requires live Anthropic API calls
- `tests/shell/` - Requires real shell execution
