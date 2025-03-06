import process from 'node:process'
import builtins from 'builtin-modules'
import * as dotenv from 'dotenv'
import esbuild from 'esbuild'
import Vue from 'esbuild-plugin-vue3'
import fs from 'fs'

// Load environment variables
dotenv.config()

// Check if we're in production mode
const prod = (process.argv[2] === 'production')



// Banner for the JS file
const jsBanner = `/*
THIS IS A PLUGIN BUILT BY LUPINUM 
If you want to view the source, please visit the github repository of this plugin
https://github.com/lupinum-dev/ginko
*/
`

// Banner for the CSS file
const cssBanner = `/*
THIS IS A PLUGIN BUILT BY LUPINUM 
CSS styles for the plugin. Auto-generated from the source files.
https://github.com/lupinum-dev/ginko
*/
`

// Credits: qingyuanTech
// https://github.com/qingyuanTech/Obsidian-Vue-Sample-Plugin/blob/main/esbuild.config.mjs
// For providing a working example how to bundle Vue 3 with esbuild

// Output paths
const jsOutfile = prod ? 'main.js' : `${process.env.OUTPATH}/main.js`
const cssOutfile = prod ? 'styles.css' : `${process.env.OUTPATH}/styles.css`
const tempCssOutfile = prod ? 'main.css' : `${process.env.OUTPATH}/main.css`

// Single esbuild context for all files
const context = await esbuild.context({
  // Basic options
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'es2018',
  logLevel: 'info',
  sourcemap: prod ? false : 'inline',
  treeShaking: true,
  minify: prod,
  
  // Entry points
  entryPoints: ['./src/main.ts'],
  
  // Output settings
  outfile: jsOutfile,
  
  // Banners
  banner: {
    js: jsBanner,
    css: cssBanner
  },
  
  // Externals
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
    ...builtins,
  ],
  
  // Plugins
  plugins: [
    Vue({
      isProd: prod,
      template: {
        compilerOptions: {
          isCustomElement: tag => tag.includes('-'),
        },
      },
      // CSS handling - extract CSS to a file
      cssInline: false,
      cssExtract: true,
      scopeId: 'hash',
      postcss: {
        options: {},
        plugins: [],
      },
    }),
  ],
  
  // Loaders
  loader: { '.css': 'css' },
})

// Function to rename CSS file
function renameCssFile() {
  fs.access(tempCssOutfile, fs.constants.F_OK, (err) => {
    if (!err) {
      fs.rename(tempCssOutfile, cssOutfile, (renameErr) => {
        if (renameErr) {
          console.error('Error renaming CSS file:', renameErr)
        } else {
          console.log(`CSS file renamed to ${cssOutfile}`)
        }
      })
    }
  })
}

// For production, build once and exit
if (prod) {
  await context.rebuild()
  renameCssFile()
  process.exit(0)
} 
// For development, watch for changes
else {
  await context.watch()
  
  // Watch for CSS file generation and rename it
  fs.watchFile(tempCssOutfile, () => {
    renameCssFile()
  })
  
  console.log('Watching for changes...')
}