/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react(), tailwindcss()],

  resolve: {
    alias: [
      // Permite import de '@/...' para 'src/...'
      { find: '@', replacement: path.resolve(__dirname, './src') },
    ],
  },

  // Tipos de arquivo suportados como assets raw
  assetsInclude: ['**/*.svg', '**/*.csv'],

  // Testes (Vitest): rodam num navegador simulado (jsdom) e medem a cobertura do código do sistema.
  // A pasta components/ui é a biblioteca de componentes de interface pronta, e não entra na conta.
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/app/**/*.{ts,tsx}'],
      exclude: ['src/app/components/ui/**'],
      reporter: ['text', 'text-summary'],
      thresholds: { lines: 25 },
    },
  },
});
