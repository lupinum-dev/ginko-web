import type { GinkoSettings } from '../../../../composables/useGinkoSettings'
import type { FileHandler } from '../NuxtTaskProcessor'
import path from 'node:path'
import { useGinkoProcessor } from '../../../../composables/useGinkoProcessor'
import { useGinkoSettings } from '../../../../composables/useGinkoSettings'
import { CacheService } from '../../../services/CacheService'
import { FileSystemService } from '../../../services/FileSystemService'

interface SlugTranslations {
  default: string
  [key: string]: string
}

interface MetaObject {
  sourcePath: string
  slug: SlugTranslations
}

export class MetaHandler implements FileHandler {
  private fileSystem: FileSystemService
  private cacheService: CacheService

  constructor() {
    this.fileSystem = new FileSystemService()
    this.cacheService = new CacheService()
  }

  /**
   * Creates a meta object from frontmatter data and source path
   */
  private createMetaObject(sourcePath: string, frontmatter: Record<string, any>): MetaObject {
    const parentDir = path.dirname(path.dirname(sourcePath))
    const currentDir = path.dirname(sourcePath)
    const translations = this.extractSlugTranslations(frontmatter)

    const { default: _, ...langTranslations } = translations
    const currentDirName = path.basename(currentDir)
    const prefix = currentDirName.match(/^\d+\./) ? currentDirName.match(/^\d+\./)?.[0] ?? '' : ''

    return {
      sourcePath: `${currentDir}/`,
      slug: {
        default: `${currentDir}/`,
        ...Object.entries(langTranslations).reduce((acc, [lang, slug]) => ({
          ...acc,
          [lang]: `${parentDir}/${prefix}${slug}/`,
        }), {}),
      },
    }
  }

  /**
   * Extracts slug translations from frontmatter
   */
  private extractSlugTranslations(frontmatter: Record<string, any>): SlugTranslations {
    const translations: SlugTranslations = { default: '' }

    Object.entries(frontmatter).forEach(([key, value]) => {
      if (key.startsWith('slug__')) {
        const lang = key.split('__')[1]
        translations[lang] = value as string
      }
    })

    return translations
  }

  /**
   * Builds a translated path by applying cached translations
   */
  private buildTranslatedPath(pathParts: string[], cacheItems: MetaObject[], locale: string): string {
    const translatedParts = [...pathParts]

    // Process all parts except the last one (current directory)
    for (let i = 1; i < pathParts.length - 1; i++) {
      const pathToCheck = `${pathParts.slice(0, i + 1).join('/')}/`
      const matchingItem = cacheItems.find(item => item.sourcePath === pathToCheck)

      if (matchingItem?.slug[locale]) {
        const translatedPart = matchingItem.slug[locale].split('/').filter(Boolean).pop()
        if (translatedPart)
          translatedParts[i] = translatedPart
      }
    }

    translatedParts.pop() // Remove the last part as it will be handled separately
    return `${translatedParts.join('/')}/`
  }

  /**
   * Creates the final meta object with combined translations
   */
  private createFinalMetaObject(
    baseMetaObject: MetaObject,
    translatedBasePaths: Record<string, string>,
  ): MetaObject {
    const { default: _, ...localeSlugPairs } = baseMetaObject.slug

    return {
      sourcePath: baseMetaObject.sourcePath,
      slug: {
        default: baseMetaObject.slug.default,
        ...Object.entries(localeSlugPairs).reduce((acc, [locale, currentSlug]) => {
          const basePath = translatedBasePaths[locale] || baseMetaObject.slug.default
          const lastSegment = currentSlug.split('/').filter(Boolean).pop()
          return {
            ...acc,
            [locale]: `${basePath}${lastSegment}`,
          }
        }, {}),
      },
    }
  }

  /**
   * Gets the paths to check in cache
   */
  private getPathsToCheck(pathParts: string[]): string[] {
    return pathParts
      .slice(1, -1) // Exclude first and last parts
      .reduce((paths: string[], _, index) => {
        paths.push(`${pathParts.slice(0, index + 2).join('/')}/`)
        return paths
      }, [])
  }

  async handle(actionType: string, sourcePath: string, oldPath?: string): Promise<void> {
    const settings: GinkoSettings = useGinkoSettings()
    const ginkoProcessor = useGinkoProcessor()

    switch (actionType) {
      case 'rebuild': {
        const fullPath = path.join(settings.paths.vaultPath, sourcePath)
        const { data: frontmatter } = await this.fileSystem.getFrontmatterContent(fullPath)

        // Create and cache meta object
        const metaObject = await this.createMetaObjectFromFile(sourcePath, frontmatter)
        const translatedPaths = await this.buildTranslatedPaths(sourcePath, metaObject)
        const finalMetaObject = this.combineTranslationsWithMeta(metaObject, translatedPaths)
        await this.addToCache(finalMetaObject)

        // Extract and process translations from frontmatter
        const translations = this.extractTranslatedFields(frontmatter, settings.defaultLocale)
        // Create directory JSON files
        await this.createDirectoryJsonFiles(finalMetaObject, translations, settings)
        break
      }

      case 'create':
        await ginkoProcessor.rebuildMarkdown()
        break

      case 'delete':
        await ginkoProcessor.rebuildMarkdown()
        break

      case 'modify':
        await ginkoProcessor.rebuildMarkdown()
        break

      case 'rename':
        await ginkoProcessor.rebuildMarkdown()
        break
    }
  }

  /**
   * Creates a meta object from a file at the given path
   */
  private async createMetaObjectFromFile(sourcePath: string, frontmatter): Promise<MetaObject> {
    return this.createMetaObject(sourcePath, frontmatter)
  }

  /**
   * Builds translated paths for all locales in the meta object
   */
  private async buildTranslatedPaths(
    sourcePath: string,
    metaObject: MetaObject,
  ): Promise<Record<string, string>> {
    const pathParts = sourcePath.split('/').filter(part => part !== '_meta.md')
    const cacheItems = this.cacheService.findMatchingMetaItems(
      this.getPathsToCheck(pathParts),
    )

    const { default: _, ...locales } = metaObject.slug
    return Object.keys(locales).reduce((acc, locale) => ({
      ...acc,
      [locale]: this.buildTranslatedPath(pathParts, cacheItems, locale),
    }), {})
  }

  /**
   * Combines the meta object with translated paths
   */
  private combineTranslationsWithMeta(
    metaObject: MetaObject,
    translatedPaths: Record<string, string>,
  ): MetaObject {
    return this.createFinalMetaObject(metaObject, translatedPaths)
  }

  /**
   * Adds the meta object to the cache
   */
  private async addToCache(metaObject: MetaObject): Promise<void> {
    this.cacheService.meta.addMetaItem(metaObject)
  }

  private extractTranslatedFields(
    frontmatter: Record<string, any>,
    defaultLocale: string,
  ): Record<string, Record<string, string>> {
    const translations: Record<string, Record<string, string>> = { default: {} }

    // Group frontmatter entries by field and locale
    Object.entries(frontmatter).forEach(([key, value]) => {
      if (key.includes('__')) {
        const [field, locale] = key.split('__')
        // Skip slug fields as they shouldn't be in the _dir.json content
        if (field === 'slug')
          return

        if (!translations[locale]) {
          translations[locale] = {}
        }
        translations[locale][field] = value as string
      }
    })

    // Handle default locale content
    const defaultLocaleContent = translations[defaultLocale] || {}
    translations.default = { ...defaultLocaleContent }

    // For locales without specific translations, use default locale content
    Object.keys(translations).forEach((locale) => {
      if (locale !== 'default' && locale !== defaultLocale) {
        translations[locale] = {
          ...defaultLocaleContent, // First spread default content
          ...translations[locale], // Then override with locale-specific content if any
        }
      }
    })

    return translations
  }

  private async createDirectoryJsonFiles(
    finalMetaObject: MetaObject,
    translations: Record<string, Record<string, string>>,
    settings: GinkoSettings,
  ): Promise<void> {
    const { slug } = finalMetaObject

    // Create JSON files for each locale
    for (const [locale, path] of Object.entries(slug)) {
      const content = translations[locale] || translations.default || {}
      // Ensure path ends with '/' before adding _dir.json
      const normalizedPath = path.endsWith('/') ? path : `${path}/`

      // Determine the language prefix
      const langPrefix = locale === 'default' ? settings.languages.mainLanguage : locale

      // Combine paths with language prefix
      const jsonPath = `${settings.paths.websitePath}/content/${langPrefix}/${normalizedPath}.navigation.json`
      // make sure path the content folder is createed
      await this.fileSystem.writeFile(jsonPath, JSON.stringify(content, null, 2))
    }
  }
}
