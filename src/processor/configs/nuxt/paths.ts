export const nuxtPaths = {
  content: 'content',
  meta: 'content',
  assets: 'assets',
  galleries: 'public/galleries'
} as const

export type NuxtPathKey = keyof typeof nuxtPaths 