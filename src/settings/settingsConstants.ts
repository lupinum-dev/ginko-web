import type { Utility, WebsiteTemplate } from './settingsTypes'

export const WEBSITE_TEMPLATES: WebsiteTemplate[] = [
  {
    id: 'nuxt-ui-pro-docs',
    name: 'Nuxt UI Pro Docs',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 256 256"><path fill="#00DC82" d="M96.3 117.5c3-4.5 7.6-7.5 12.9-7.5h38.4c5.3 0 9.9 3 12.9 7.5l19.2 30c3 4.5 3 10.5 0 15l-19.2 30c-3 4.5-7.6 7.5-12.9 7.5h-38.4c-5.3 0-9.9-3-12.9-7.5l-19.2-30c-3-4.5-3-10.5 0-15l19.2-30Z"/></svg>',
    description: 'Beautiful documentation template with Nuxt UI Pro components',
  },
  {
    id: 'nuxt-ui-pro-saas',
    name: 'Nuxt UI Pro SaaS',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 256 256"><path fill="#00DC82" d="M96.3 117.5c3-4.5 7.6-7.5 12.9-7.5h38.4c5.3 0 9.9 3 12.9 7.5l19.2 30c3 4.5 3 10.5 0 15l-19.2 30c-3 4.5-7.6 7.5-12.9 7.5h-38.4c-5.3 0-9.9-3-12.9-7.5l-19.2-30c-3-4.5-3-10.5 0-15l19.2-30Z"/></svg>',
    description: 'SaaS template with authentication and billing',
  },
  {
    id: 'docusaurus',
    name: 'Docusaurus',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 256 256"><path fill="#3ECC5F" d="M128 0C57.3 0 0 57.3 0 128s57.3 128 128 128s128-57.3 128-128S198.7 0 128 0Z"/></svg>',
    description: 'Modern static website generator by Facebook/Meta',
  },
  {
    id: 'astro-starlight',
    name: 'Astro Starlight',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 256 256"><path fill="#FF5D01" d="M163.008 19.198c6.177-7.363 17.082-8.38 24.586-2.375c7.504 6.006 8.525 16.711 2.348 24.074L84.698 164.902c-6.177 7.363-17.082 8.38-24.586 2.375c-7.504-6.006-8.525-16.711-2.348-24.074l105.244-124.005Z"/></svg>',
    description: 'Documentation theme for Astro with full-featured markdown support',
  },
  {
    id: 'fumadocs',
    name: 'FumaDocs',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path fill="#4F46E5" d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5s1.5.67 1.5 1.5s-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5s1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z"/></svg>',
    description: 'Next.js documentation starter with full text search',
  },
  {
    id: 'vitepress',
    name: 'VitePress',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 256 256"><path fill="#41B883" d="m179.086 39.543l-50.95 88.272l-50.95-88.272H0l128.136 221.954L256 39.543z"/></svg>',
    description: 'Simple, powerful, and fast static site generator by Vite',
  },
  {
    id: 'ginko-docs',
    name: 'Ginko Docs',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path fill="#87285E" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10s10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8s8 3.59 8 8s-3.59 8-8 8z"/></svg>',
    description: 'Official Ginko documentation template',
  },
]

export const UTILITIES: Utility[] = [
  {
    id: 'colocationFolder',
    name: 'Colocation Folder',
    description: 'Utility which helps you to create a colocation folder.',
    warning: '',
    links: [
      { text: 'Read our documentation', url: 'https://ginko.build/docs/utilities/syntax-highlight' },
    ],
  },
  {
    id: 'linter',
    name: 'Linter',
    description: 'Utility which helps you to checks your files for errors.',
    warning: '',
    links: [
      { text: 'Read our documentation', url: 'https://ginko.build/docs/utilities/syntax-highlight' },
    ],
  },
  {
    id: 'debug',
    name: 'Debug Mode',
    description: 'Enable debug logging to help troubleshoot issues.',
    warning: 'Note: Enabling debug mode may affect performance and will output additional logs to the console.',
    links: [],
  },
]
