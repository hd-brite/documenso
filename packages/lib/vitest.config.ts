import macrosPlugin from 'vite-plugin-babel-macros';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Lingui `msg` / `Trans` macros are compiled at build time; the same Babel
  // macros plugin the Remix app uses lets tests render the email templates.
  plugins: [macrosPlugin()],
  esbuild: { jsx: 'automatic' },
  test: {
    include: ['**/*.test.ts', '**/*.test.tsx'],
  },
});
