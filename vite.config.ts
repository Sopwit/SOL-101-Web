import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// Vite konfigurasyonu:
// Solana kutuphanelerinin tarayicida calismasi icin gerekli polyfill'leri,
// vendor chunk ayrimini ve temel alias tanimlarini tek yerde toplar.
export default defineConfig(() => ({
  plugins: [
    // React ve Tailwind plugin'leri uygulama iskeletinin temel parcasidir.
    // Tailwind aktif kullanilmayan bir ekranda bile plugin silinmemelidir.
    react(),
    tailwindcss(),
    nodePolyfills({
      include: ['buffer', 'process', 'stream', 'crypto', 'util', 'vm'],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
  ],
  resolve: {
    alias: {
      // Uygulama ici import'larda src kokune kisa erisim.
      '@': path.resolve(__dirname, './src'),
      // Solana kutuphaneleri icin browser tarafinda Buffer cozumu.
      buffer: 'buffer/',
    },
  },
  define: {
    // Bazi Solana paketleri global nesnesi bekledigi icin browser fallback'i.
    global: 'globalThis',
    // Vite'in process.env erisimini dissallastirmasini engeller.
    'process.env': {},
  },
  optimizeDeps: {
    esbuildOptions: {
      // Prebundle asamasinda global tanimlarini da ayni sekilde koru.
      define: {
        global: 'globalThis'
      },
    },
    include: ['buffer'],
  },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      onwarn(warning, defaultHandler) {
        // `ox` paketlerindeki hatali PURE annotation yorumu build'i bozmaz;
        // bu nedenle sadece ilgili ucuncu parti uyarisi susturulur.
        if (
          warning.code === 'INVALID_ANNOTATION' &&
          typeof warning.id === 'string' &&
          warning.id.includes('/node_modules/ox/_esm/')
        ) {
          return
        }

        defaultHandler(warning)
      },
      output: {
        manualChunks(id) {
          // Ucuncu parti bagimliliklar ayri chunk'lara bolunerek ilk yukleme
          // ve cache davranisi iyilestirilir.
          if (!id.includes('node_modules')) {
            return
          }

          if (id.includes('@solana') || id.includes('@coral-xyz') || id.includes('@walletconnect') || id.includes('@reown')) {
            return 'solana-vendor'
          }

          if (id.includes('react') || id.includes('scheduler')) {
            return 'react-vendor'
          }

          if (id.includes('motion') || id.includes('date-fns') || id.includes('lucide-react')) {
            return 'ui-vendor'
          }
        },
      },
    },
  },

  // Ham varlik olarak import edilmesine izin verilen dosya tipleri.
  assetsInclude: ['**/*.svg', '**/*.csv'],
}))
