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
});
