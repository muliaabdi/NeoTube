// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    rules: {
      'react-hooks/immutability': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/use-memo': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/rules-of-hooks': 'warn',
    },
  },
  {
    // Whole-repo runs resolve these installed packages as missing even though
    // scoped runs, tsc, bundling, and require.resolve all find them; keep the
    // import plugin from failing on them.
    settings: {
      'import/core-modules': ['@radix-ui/colors', '@radix-ui/themes'],
    },
  },
  {
    ignores: ['dist/*'],
  },
]);
