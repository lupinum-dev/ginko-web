export const astroPaths = {
  content: 'src/content',
  meta: 'src/content/meta',
  assets: 'src/assets',
  galleries: 'src/public/galleries'
} as const

export type AstroPathKey = keyof typeof astroPaths 