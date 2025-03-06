import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import * as path from 'node:path'
import { builtinModules } from 'node:module'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '')
  
  const isProd = mode === 'production'
  const outDir = isProd ? '.' : env.OUTPATH || 'dist'

  return {
    plugins: [
      vue({
        template: {
          compilerOptions: {
            isCustomElement: tag => tag.includes('-'),
          },
        },
      }),
    ],
    
    build: {
      // Output directory
      outDir,
      emptyOutDir: false, // Don't empty the output directory to avoid deleting other plugin files
      
      // Bundle configuration
      lib: {
        entry: path.resolve(__dirname, 'src/main.ts'),
        name: 'GinkoWeb',
        formats: ['cjs'],
        fileName: () => 'main.js',
      },
      
      // Minification and sourcemaps
      minify: isProd,
      sourcemap: !isProd,
      
      // CSS handling
      cssCodeSplit: false,
      
      // Rollup options
      rollupOptions: {
        external: [
          'obsidian',
          'electron',
          '@codemirror/autocomplete',
          '@codemirror/collab',
          '@codemirror/commands',
          '@codemirror/language',
          '@codemirror/lint',
          '@codemirror/search',
          '@codemirror/state',
          '@codemirror/view',
          '@lezer/common',
          '@lezer/highlight',
          '@lezer/lr',
          ...builtinModules,
        ],
        output: {
          format: 'cjs',
          exports: 'default',
          banner: `/*
THIS IS A PLUGIN BUILT BY LUPINUM 
If you want to view the source, please visit the github repository of this plugin
https://github.com/lupinum-dev/ginko
*/`,
          entryFileNames: 'main.js',
          assetFileNames: (assetInfo) => {
            if (assetInfo.name && assetInfo.name.endsWith('.css')) return 'styles.css';
            return assetInfo.name || '';
          },
        },
      },
    },
    
    // Resolve aliases
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  }
}) 