import { FileSystemService } from '../../../services/FileSystemService'
import { CacheService } from '../../../services/CacheService'
import { useGinkoProcessor } from '../../../../composables/useGinkoProcessor'
import { FileHandler } from '../NuxtTaskProcessor'
import path from 'path'
import { useGinkoSettings, type GinkoSettings } from '../../../../composables/useGinkoSettings'
import { BatchedTask } from '../../../types/framework'
import { LinkModifier, AssetLinkModifier, type ContentModifier, GalleryModifier, HighlightModifier } from '../markdownModifier'
import { CalloutModifier } from './markdownModifier/CalloutModifier'
import { TabsModifier } from './markdownModifier/TabsModifier'
import { FileTreeModifier } from './markdownModifier/FileTreeModifier'
import { FaqModifier } from './markdownModifier/FAQ'
import { StepsModifier } from './markdownModifier/StepsModifier'


type FileInfo = {
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
      new LinkModifier(),
      new AssetLinkModifier(),
      new GalleryModifier(),
      new HighlightModifier(),
      new CalloutModifier(),
      new TabsModifier(),
      new FileTreeModifier(),
      new FaqModifier(),
      new StepsModifier()
    ]
  }

  private getSettings(): GinkoSettings {
    return useGinkoSettings()
  }

  private parseFileInfo(lastPart: string, beforeLastPart: string): FileInfo {
    const fileNameWithoutExt = lastPart.replace(/\.md$/, '')
    const localeMatch = fileNameWithoutExt.match(/^(.+)__([a-z]{2})$/)
    const colocationMatch = beforeLastPart.match(/^(?:\d+\.)?\s*(.+?)\s*-\s*([a-z0-9]+)\+$/)

    console.log('Parsing File Info:', {
        fileNameWithoutExt,
        beforeLastPart,
        localeMatch,
        colocationMatch
    })

    return {
        isLocalized: !!localeMatch,
        locale: localeMatch ? localeMatch[2] : null,
        baseName: localeMatch ? localeMatch[1] : fileNameWithoutExt,
        isColocated: !!colocationMatch,
        colocationId: colocationMatch ? colocationMatch[2] : null,
        colocationBaseName: colocationMatch ? colocationMatch[1].trim() : beforeLastPart
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
    return `${fileInfo.locale || settings.defaultLocale}/${dirPath}/${fileName}.md`
  }

  private generateColocatedOutputPath(fileInfo: FileInfo, sourcePathParts: string[]): string {
    const settings = this.getSettings()
    
    const sanitizedBaseName = fileInfo.baseName
        .replace(/\s+/g, '-')
        .toLowerCase()
        .trim()
    
    const fileName = `${sanitizedBaseName}-${fileInfo.colocationId}`
    
    console.log('Colocated Path Generation:', {
        baseName: fileInfo.baseName,
        sanitizedBaseName,
        colocationId: fileInfo.colocationId,
        generatedFileName: fileName,
        sourcePathParts
    })

    if (fileInfo.locale === settings.defaultLocale) {
        const dirPath = sourcePathParts.slice(0, -2)
            .join('/')
            .replace(/\s+/g, '-')
            .toLowerCase()
        return `${settings.defaultLocale}/${dirPath}/${fileName}.md`
    }

    const checkLocalizedPath = sourcePathParts.slice(0, -2).join('/') + '/'
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
    const { data: frontmatter, content } = await this.fileSystem.getFrontmatterContent(sourcePath)
    
    // Apply all modifiers to the content
    const modifiedContent = this.modifiers.reduce(
        (currentContent, modifier) => modifier.modify(currentContent, frontmatter),
        content
    )

    // The modifiedContent now includes the updated frontmatter from matter.stringify()
    return modifiedContent;
  }

  private async copyToTarget(sourcePath: string, outputPath: string): Promise<void> {
    const settings = this.getSettings()
    const targetPath = path.join(settings.outputDirectoryPath, outputPath)
    

    // Process markdown content before copying
    const processedContent = await this.processMarkdownContent(sourcePath)
    
    // Ensure target directory exists and write the processed content
    // Using writeFile will automatically overwrite if the file exists
    await this.fileSystem.writeFile(targetPath, processedContent)
    console.log('Processed and copied file to:', targetPath)
  }

  async handle(actionType: string, sourcePath: string, oldPath?: string): Promise<void> {
    const ginkoProcessor = useGinkoProcessor()
    const settings = this.getSettings()
    
    switch (actionType) {
      case 'rebuild':
      case 'modify': 
      case 'create': {
        const fullPath = path.join(settings.sourceDirectoryPath, sourcePath)
        const sourcePathParts = sourcePath.split('/')
        
        const lastPart = sourcePathParts[sourcePathParts.length - 1].trim()
        const beforeLastPart = sourcePathParts[sourcePathParts.length - 2]?.trim() || ''

        console.log('Processing File:', {
            sourcePath,
            lastPart,
            beforeLastPart
        })

        const fileInfo = this.parseFileInfo(lastPart, beforeLastPart)
        
        console.log('File Info:', fileInfo)
        
        const outputPath = 'content/' + this.generateOutputPath(sourcePath, fileInfo, sourcePathParts)
        
        console.log('Generated Output Path:', outputPath)
        
        await this.copyToTarget(fullPath, outputPath)
        break
      }

      case 'delete': {
        const sourcePathParts = sourcePath.split('/')
        const lastPart = sourcePathParts[sourcePathParts.length - 1].trim()
        const beforeLastPart = sourcePathParts[sourcePathParts.length - 2]?.trim() || ''

        const fileInfo = this.parseFileInfo(lastPart, beforeLastPart)
        console.log('File Info for deletion:', fileInfo)
        
        const outputPath = 'content/' + this.generateOutputPath(sourcePath, fileInfo, sourcePathParts)
        const fullTargetPath = path.join(settings.outputDirectoryPath, outputPath)
        
        console.log('Deleting file at:', fullTargetPath)
        await this.fileSystem.deleteFile(fullTargetPath)
        break
      }
    }
  }

  async afterCompletion(batch: BatchedTask): Promise<void> {
    if (batch.fileType === 'markdown') {
      console.log('📝 Markdown batch processing complete!', {
        action: batch.action,
        files: batch.files.length
      })
    }
  }
}
