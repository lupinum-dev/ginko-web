export const docusaurusPaths = {
  content: 'src/content',
  meta: 'src/content/meta',
  assets: 'src/assets',
  galleries: 'src/public/galleries',
} as const

export type DocusaurusPathKey = keyof typeof docusaurusPaths
