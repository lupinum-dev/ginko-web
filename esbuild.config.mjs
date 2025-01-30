import process from 'node:process'
import builtins from 'builtin-modules'
import * as dotenv from 'dotenv'
import esbuild from 'esbuild'
import Vue from 'esbuild-plugin-vue3'

const banner
  = `/*
THIS IS A PLUGIN BUILT BY LUPINUM 
if you want to view the source, please visit the github repository of this plugin
https://github.com/lupinum-dev/ginko-web
*/
`

const prod = (process.argv[2] === 'production')
dotenv.config()

const jsContext = await esbuild.context({
  banner: {
    js: banner,
  },
  entryPoints: [
    './src/main.ts',
  ],
  plugins: [
    Vue({
      isProd: prod,
      template: {
        compilerOptions: {
          isCustomElement: tag => tag.includes('-'),
        },
      },
      cssInline: true,
      scopeId: 'hash',
      postcss: {
        options: {},
        plugins: [],
      },
    }),
  ],
  bundle: true,
  platform: 'node',
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
  format: 'cjs',
  target: 'es2018',
  logLevel: 'info',
  sourcemap: prod ? false : 'inline',
  treeShaking: true,
  outfile: `${process.env.OUTPATH}/main.js` || './main.js',
  entryNames: '[name]',
  minify: prod,
  loader: { '.css': 'css' },
})

const cssContext = await esbuild.context({
  entryPoints: ['src/main.css'],
  outfile: `${process.env.OUTPATH}/styles.css` || './styles.css',
  bundle: true,
  allowOverwrite: true,
  minify: false,
})

if (prod) {
  await jsContext.rebuild()
  await cssContext.rebuild()
  process.exit(0)
}
else {
  await jsContext.watch()
  await cssContext.watch()
}
