# Tests

This directory contains unit and integration tests for the `pls` command-line tool.

## Quality Checks

To verify code quality, run these commands in sequence:

```bash
npm run build   # TypeScript compilation
npm run format  # Code formatting
npm run lint    # Code quality
npm test        # Test suite
```

Additional test commands:

```bash
npm run test:watch  # Watch mode (auto-rerun on changes)
npm test -- --coverage  # With coverage report
```

## Testing Approach

**Unit Tests**: Test individual functions and classes in isolation with mocked dependencies.

**Integration Tests**: Test component interactions using mock implementations.

**Key Principles**:

- Interface-based design enables easy mocking
- Dependency injection for testability
- Type-safe mocks implement proper interfaces
- No real API calls in tests

## Adding Tests

When adding new features:

1. Write tests for new functionality
2. Mock external dependencies properly
3. Test both success and error paths
4. Verify all quality checks pass
