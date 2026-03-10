import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig(({ mode }) => ({
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
    nodePolyfills({
      include: ['buffer', 'process', 'stream', 'crypto', 'util'],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
      // Buffer polyfill for Solana libraries
      buffer: 'buffer/',
    },
  },
  define: {
    // Define global for Solana libraries
    global: 'globalThis',
    // Prevent Vite from externalizing buffer
    'process.env': {},
  },
  optimizeDeps: {
    esbuildOptions: {
      // Node.js global polyfills
      define: {
        global: 'globalThis'
      },
    },
    include: ['buffer'],
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
}))