import type { FileTypeCheck } from '../nuxt/fileTypes'
import { commonFileTypes } from '../nuxt/fileTypes'

export const astroFileTypes: FileTypeCheck[] = [
  ...commonFileTypes,
  // Add any Astro-specific file types here
]
