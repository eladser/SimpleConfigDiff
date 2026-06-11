import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ command, mode }) => {
  const isDev = command === 'serve'
  
  return {
    plugins: [react()],
    base: isDev ? '/' : '/SimpleConfigDiff/',
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (/[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'vendor'
              if (/[\\/](js-yaml|fast-xml-parser|ini|smol-toml)[\\/]/.test(id)) return 'parsers'
              if (/[\\/](@codemirror|@lezer|@uiw|codemirror|style-mod|w3c-keyname|crelt)[\\/]/.test(id)) return 'editor'
            }
          },
          entryFileNames: 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]'
        },
      },
      assetsDir: 'assets',
    },
    server: {
      port: 3000,
    },
  }
})