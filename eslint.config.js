import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default [
  js.configs.recommended,
  prettier,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': 'warn',
      eqeqeq: 'error',
      'prefer-const': 'error',
    },
  },
  {
    // Adaptador vendorizado tal cual desde "Conector DB PHP" (código ya
    // probado en producción en otro proyecto) — no se relintea/reformatea
    // para no arriesgar cambiar su comportamiento.
    ignores: ['node_modules/', 'logs/', 'uploads/', 'src/database/mysqlHttpBridge.cjs'],
  },
];
