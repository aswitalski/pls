import tseslint from 'typescript-eslint';

export default tseslint.config(
  // Ignore build output and dependencies
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  // Base ESLint recommended rules for JS files
  {
    files: ['**/*.js'],
    ...tseslint.configs.recommended[0],
  },
  // Strict TypeScript rules with type checking for TS files
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ['**/*.{ts,tsx}'],
  })),
  ...tseslint.configs.strict.map((config) => ({
    ...config,
    files: ['**/*.{ts,tsx}'],
  })),
  ...tseslint.configs.strictTypeChecked.map((config) => ({
    ...config,
    files: ['**/*.{ts,tsx}'],
  })),
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.eslint.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Allow console statements (useful for CLI apps)
      'no-console': 'off',
      // Warn on unused variables, but allow if prefixed with underscore
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      // Allow numbers and booleans in template literals
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        {
          allowNumber: true,
          allowBoolean: true,
        },
      ],
      // Disable unified-signatures due to ESLint bug with inline object types
      // The rule crashes with "TypeError: typeParameters.params is not iterable"
      // when it encounters inline object types in function signatures
      '@typescript-eslint/unified-signatures': 'off',
    },
  },
  // Relaxed rules for test files
  {
    files: ['**/*.test.{ts,tsx}', '**/tests/**/*.{ts,tsx}'],
    rules: {
      // Allow async test mocks without await
      '@typescript-eslint/require-await': 'off',
      // Allow non-null assertions in tests (after toBeDefined checks)
      '@typescript-eslint/no-non-null-assertion': 'off',
      // Allow throwing non-Error objects in tests (for testing error handling)
      '@typescript-eslint/only-throw-error': 'off',
      // Allow any type in test mocks and utilities
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
    },
  }
);
