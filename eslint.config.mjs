import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Lint konfigurasyonu:
// frontend, backend function ve on-chain yardimci katmanini tek konfigurasyonda
// toplar; uretilen klasorleri ise bilincli olarak disarida birakir.
export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'target/**',
      '.vite/**',
      'supabase/.temp/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.deno,
      },
    },
  }
  ,
  {
    files: ['functions/server/**/*.tsx', 'src/app/lib/onchain/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  }
);
