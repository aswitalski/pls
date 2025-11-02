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
    files: ['**/*.ts'],
  })),
  ...tseslint.configs.strict.map((config) => ({
    ...config,
    files: ['**/*.ts'],
  })),
  ...tseslint.configs.strictTypeChecked.map((config) => ({
    ...config,
    files: ['**/*.ts'],
  })),
  {
    files: ['**/*.ts'],
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
    },
  }
);
