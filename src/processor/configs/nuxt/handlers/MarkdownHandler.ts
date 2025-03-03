import type { GinkoWebSettings } from '../../../../composables/useGinkoSettings'
import type { BatchedTask } from '../../../../types/framework'
import type { ContentModifier } from '../markdownModifier'
import type { FileHandler } from '../NuxtTaskProcessor'
import * as path from 'node:path'
import { useGinkoSettings } from '../../../../composables/useGinkoSettings'
import { CacheService } from '../../../services/CacheService'
import { FileSystemService } from '../../../services/FileSystemService'
import { slugify } from '../utils/slugify'
import { stringifyYAML } from 'confbox'
import { parseMarkdown } from './markdownModifier/utils/ginkoParser'
import { CalloutModifier } from './markdownModifier/CalloutModifier'
import { LayoutModifier } from './markdownModifier/LayoutModifier'
import { TabsModifier } from './markdownModifier/TabsModifier'
import { StepsModifier } from './markdownModifier/StepsModifier'
import { MarkdownModifier } from './markdownModifier/MarkdownModifier'
import { astToMarkdown } from './markdownModifier/utils/astToMarkdown'

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

    // Initialize modifiers with CalloutModifier, LayoutModifier, TabsModifier, and StepsModifier
    const markdownModifier = new MarkdownModifier([
      new CalloutModifier(),
      new LayoutModifier(),
      new TabsModifier(),
      new StepsModifier()
    ])
    this.modifiers = [markdownModifier]
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

    const colocationFolder = sourcePathParts[sourcePathParts.length - 2]
    const numericPrefix = colocationFolder.match(/^(\d+\.)/)?.[1] || ''

    const sanitizedBaseName = slugify(fileInfo.baseName, {
      separator: '-',
      preserveLeadingNumbers: true
    })

    const fileName = `${numericPrefix}${sanitizedBaseName}-${fileInfo.colocationId}`

    const checkLocalizedPath = `${sourcePathParts.slice(0, -2).join('/')}/`
    const metaItem = this.cacheService.meta.getMetaItem(checkLocalizedPath)

    if (metaItem?.slug && fileInfo.locale && metaItem.slug[fileInfo.locale]) {
      return `${fileInfo.locale}/${metaItem.slug[fileInfo.locale]}/${fileName}.md`
    }

    const dirPath = sourcePathParts.slice(0, -2)
      .join('/')

    return `${fileInfo.locale || settings.languages.mainLanguage}/${dirPath}/${fileName}.md`
  }

  private async processMarkdownContent(sourcePath: string): Promise<string> {
    try {
      const { data: frontmatter, content } = await this.fileSystem.getFrontmatterContent(sourcePath)

      // Parse the content into a Ginko AST
      const ast = parseMarkdown(content)
      console.log('ast', JSON.stringify(ast, null, 2))

      // Apply all modifiers to the AST
      let modifiedAst = ast
      for (const modifier of this.modifiers) {
        modifiedAst = modifier.modify(modifiedAst)
      }
      console.log('modifiedAst', JSON.stringify(modifiedAst, null, 2))

      // Convert modified AST back to markdown
      let modifiedContent = astToMarkdown(modifiedAst)

      // Remove any empty frontmatter that might have been added by modifiers
      modifiedContent = modifiedContent.replace(/^---\s*\n\s*---\s*\n/, '')

      // Check if content already has valid frontmatter
      const hasFrontmatterMarkers = modifiedContent.trim().match(/^---\s*\n[\s\S]+?\n---\s*\n/)

      // Only add frontmatter if it doesn't already exist and we have data
      const hasKeys = Object.keys(frontmatter).length > 0
      if (hasFrontmatterMarkers) {
        return modifiedContent
      }
      const yamlString = hasKeys ? stringifyYAML(frontmatter) : ''
      const frontmatterYaml = hasKeys
        ? `---\n${yamlString.trim()}\n---\n\n`
        : ''
      const finalContent = `${frontmatterYaml}${modifiedContent}`

      return finalContent
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