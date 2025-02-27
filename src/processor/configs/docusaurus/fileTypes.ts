// Add processing order constant
export const fileTypeProcessingOrder = [
  'asset',
  'galleryFile',
  'meta',
  'markdown',
  'other',
] as const

export interface FileTypeCheck {
  type: string
  check: (path: string) => boolean
}

export const commonFileTypes: FileTypeCheck[] = [
  {
    type: 'asset',
    check: (path: string) => path.includes('_assets/'),
  },
  {
    type: 'meta',
    check: (path: string) => path.endsWith('_meta.md'),
  },
  {
    type: 'markdown',
    check: (path: string) => path.endsWith('.md'),
  },
  {
    type: 'galleryFile',
    check: (path: string) => {
      const hasExtension = path.includes('.')
      return hasExtension && path.includes('_galleries')
    },
  },
  {
    type: 'other',
    check: () => true,
  },
]

export const docusaurusFileTypes: FileTypeCheck[] = [
  ...commonFileTypes,
  // Add any Nuxt-specific file types here
]
