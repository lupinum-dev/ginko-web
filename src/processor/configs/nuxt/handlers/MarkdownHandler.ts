import type { GinkoWebSettings } from '../../../../composables/useGinkoSettings'
import type { BatchedTask } from '../../../../types/framework'
import type { ContentModifier } from '../markdownModifier'
import type { FileHandler } from '../NuxtTaskProcessor'
import * as path from 'node:path'
import { useGinkoSettings } from '../../../../composables/useGinkoSettings'
import { CacheService } from '../../../services/CacheService'
import { FileSystemService } from '../../../services/FileSystemService'
import { AssetLinkModifier, GalleryModifier, HighlightModifier, LinkModifier } from '../markdownModifier'
import { CalloutModifier } from './markdownModifier/CalloutModifier'
import { FaqModifier } from './markdownModifier/FAQ'
import { FileTreeModifier } from './markdownModifier/FileTreeModifier'
import { LayoutModifier } from './markdownModifier/LayoutModifier'
import { StepsModifier } from './markdownModifier/StepsModifier'
import { TabsModifier } from './markdownModifier/TabsModifier'

interface FileInfo {
  isLocalized: boolean
  locale: string | null
  baseName: string
  isColocated: boolean
  colocationId: string | null
  colocationBaseName: string
}

export class MarkdownHandler implements FileHandler {
  private fileSystem: FileSystemService
  private cacheService: CacheService
  private modifiers: ContentModifier[]

  constructor() {
    this.fileSystem = new FileSystemService()
    this.cacheService = new CacheService()
    this.modifiers = [
      new CalloutModifier(),
      new LinkModifier(),
      new AssetLinkModifier(),
      new GalleryModifier(),
      new HighlightModifier(),
      new TabsModifier(),
      new FileTreeModifier(),
      new FaqModifier(),
      new StepsModifier(),
      new LayoutModifier(),
    ]
  }

  private getSettings(): GinkoWebSettings {
    return useGinkoSettings()
  }

  private parseFileInfo(lastPart: string, beforeLastPart: string): FileInfo {
    const fileNameWithoutExt = lastPart.replace(/\.md$/, '')
    const localeMatch = fileNameWithoutExt.match(/^(.+)__([a-z]{2})$/)
    const colocationMatch = beforeLastPart.match(/^(?:\d+\.)?\s*(.+?)\s*-\s*([a-z0-9]+)\+$/)

    return {
      isLocalized: !!localeMatch,
      locale: localeMatch ? localeMatch[2] : null,
      baseName: localeMatch ? localeMatch[1] : fileNameWithoutExt,
      isColocated: !!colocationMatch,
      colocationId: colocationMatch ? colocationMatch[2] : null,
      colocationBaseName: colocationMatch ? colocationMatch[1].trim() : beforeLastPart,
    }
  }

  private generateOutputPath(sourcePath: string, fileInfo: FileInfo, sourcePathParts: string[]): string {
    if (!fileInfo.isColocated) {
      return this.generateSimpleOutputPath(sourcePath, fileInfo)
    }
    return this.generateColocatedOutputPath(fileInfo, sourcePathParts)
  }

  private generateSimpleOutputPath(sourcePath: string, fileInfo: FileInfo): string {
    const settings = this.getSettings()
    const fileName = path.basename(sourcePath, '.md')
    const dirPath = path.dirname(sourcePath)
    return `${fileInfo.locale || settings.languages.mainLanguage}/${dirPath}/${fileName}.md`
  }

  private generateColocatedOutputPath(fileInfo: FileInfo, sourcePathParts: string[]): string {
    const settings = this.getSettings()

    // Extract numeric prefix if it exists in the colocation folder name
    const colocationFolder = sourcePathParts[sourcePathParts.length - 2]
    const numericPrefix = colocationFolder.match(/^(\d+\.)/)?.[1] || ''

    const sanitizedBaseName = fileInfo.baseName
      .replace(/\s+/g, '-')
      .toLowerCase()
      .trim()

    const fileName = `${numericPrefix}${sanitizedBaseName}-${fileInfo.colocationId}`

    if (fileInfo.locale === settings.languages.mainLanguage) {
      const dirPath = sourcePathParts.slice(0, -2)
        .join('/')
        .replace(/\s+/g, '-')
        .toLowerCase()
      return `${settings.languages.mainLanguage}/${dirPath}/${fileName}.md`
    }

    const checkLocalizedPath = `${sourcePathParts.slice(0, -2).join('/')}/`
    const metaItem = this.cacheService.meta.getMetaItem(checkLocalizedPath)

    if (metaItem?.slug && fileInfo.locale && metaItem.slug[fileInfo.locale]) {
      return `${fileInfo.locale}/${metaItem.slug[fileInfo.locale]}/${fileName}.md`
    }

    const dirPath = sourcePathParts.slice(0, -2)
      .join('/')
      .replace(/\s+/g, '-')
      .toLowerCase()
    return `${fileInfo.locale}/${dirPath}/${fileName}.md`
  }

  private async processMarkdownContent(sourcePath: string): Promise<string> {
    try {
      const { data: frontmatter, content } = await this.fileSystem.getFrontmatterContent(sourcePath)
      // Apply all modifiers to the content
      const modifiedContent = this.modifiers.reduce(
        (currentContent, modifier) => modifier.modify(currentContent, frontmatter),
        content,
      )
      return modifiedContent
    }
    catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist yet, return empty content with default frontmatter
        return '---\ntitle: Untitled\n---\n\n'
      }
      throw error
    }
  }

  private async copyToTarget(sourcePath: string, outputPath: string): Promise<void> {
    const settings = this.getSettings()
    if (!settings.paths.websitePath) {
      throw new Error('Website path is not configured')
    }

    console.log('Copying to target:', sourcePath, outputPath)
    const targetPath = path.join(settings.paths.websitePath, outputPath)

    // Process markdown content before copying
    const processedContent = await this.processMarkdownContent(sourcePath)

    // Ensure target directory exists and write the processed content
    await this.fileSystem.ensureDir(path.dirname(targetPath))
    await this.fileSystem.writeFile(targetPath, processedContent)
  }

  async handle(actionType: string, sourcePath: string): Promise<void> {
    const settings = this.getSettings()

    // Validate required paths
    if (!settings.paths.websitePath) {
      throw new Error('Website path is not configured')
    }

    switch (actionType) {
      case 'rebuild':
      case 'modify':
      case 'create': {
        if (!settings.paths.vaultPath) {
          throw new Error('Vault path is not configured')
        }
        const fullPath = path.join(settings.paths.vaultPath, sourcePath)

        const sourcePathParts = sourcePath.split('/')

        const lastPart = sourcePathParts[sourcePathParts.length - 1].trim()
        const beforeLastPart = sourcePathParts[sourcePathParts.length - 2]?.trim() || ''

        const fileInfo = this.parseFileInfo(lastPart, beforeLastPart)

        console.log('Generating output path:', sourcePath, fileInfo, sourcePathParts)
        const outputPath = `content/${this.generateOutputPath(sourcePath, fileInfo, sourcePathParts)}`

        await this.copyToTarget(fullPath, outputPath)
        break
      }

      case 'delete': {
        const sourcePathParts = sourcePath.split('/')
        const lastPart = sourcePathParts[sourcePathParts.length - 1].trim()
        const beforeLastPart = sourcePathParts[sourcePathParts.length - 2]?.trim() || ''

        const fileInfo = this.parseFileInfo(lastPart, beforeLastPart)

        const outputPath = `content/${this.generateOutputPath(sourcePath, fileInfo, sourcePathParts)}`
        const fullTargetPath = path.join(settings.paths.websitePath, outputPath)

        await this.fileSystem.deleteFile(fullTargetPath)
        break
      }
    }
  }

  async afterCompletion(batch: BatchedTask): Promise<void> {

  }
}
