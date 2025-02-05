import type { GinkoWebSettings } from '../../../../composables/useGinkoSettings'
import type { FileHandler } from '../NuxtTaskProcessor'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { imageMeta } from 'image-meta'
import { useGinkoProcessor } from '../../../../composables/useGinkoProcessor'
import { useGinkoSettings } from '../../../../composables/useGinkoSettings'
import { CacheService } from '../../../services/CacheService'
import { FileSystemService } from '../../../services/FileSystemService'

export class AssetHandler implements FileHandler {
  private fileSystem: FileSystemService
  private cacheService: CacheService
  private readonly imageExtensions = new Set([
    '.jpg',
    '.jpeg',
    '.png',
    '.gif',
    '.webp',
    '.svg',
    '.bmp',
    '.tiff',
    '.ico',
    '.heic',
    '.heif',
    '.avif',
  ])

  constructor() {
    this.fileSystem = new FileSystemService()
    this.cacheService = new CacheService()
  }

  private isImage(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase()
    return this.imageExtensions.has(ext)
  }

  private async getImageDimensions(sourcePath: string) {
    // Early return for non-image files without attempting to read them
    if (!this.isImage(sourcePath)) {
      return undefined
    }

    try {
      // Check if file exists and is readable before attempting to process
      await fs.access(sourcePath, fs.constants.R_OK)
      const imageBuffer = await fs.readFile(sourcePath)

      try {
        const meta = imageMeta(imageBuffer)
        if (!meta?.width || !meta?.height) {
          return undefined
        }
        return {
          width: meta.width,
          height: meta.height,
        }
      }
      catch (metaError) {
        console.debug(`Unable to parse image metadata for ${sourcePath}:`, metaError)
        return undefined
      }
    }
    catch (error) {
      console.debug(`Unable to read file ${sourcePath}:`, error)
      return undefined
    }
  }

  async handle(actionType: string, sourceRelativePath: string, oldRelativePath?: string): Promise<void> {
    const ginkoProcessor = useGinkoProcessor()
    const settings: GinkoWebSettings = useGinkoSettings()

    try {
      switch (actionType) {
        case 'create':
        case 'rebuild': {
          const { outputRelativePath, uid } = await this.fileSystem.getAssetOutputPath(sourceRelativePath)
          if (!settings.paths.vaultPath || !settings.paths.websitePath) {
            throw new Error('Vault path or website path is not configured')
          }
          const sourcePath = path.join(settings.paths.vaultPath, sourceRelativePath)

          await this.fileSystem.copyFile(sourcePath, path.join(settings.paths.websitePath, outputRelativePath))

          // Only attempt to get image dimensions for actual image files
          const size = await (this.isImage(sourcePath) ? this.getImageDimensions(sourcePath) : undefined)

          await this.cacheService.addCacheItem({
            id: uid,
            sourcePaths: [sourceRelativePath],
            targetPath: outputRelativePath,
            size,

          })
          break
        }

        case 'delete': {
          const cacheItem = this.cacheService.getCacheItemBySourcePath(sourceRelativePath)
          if (!cacheItem) {
            console.warn(`Asset not found in cache during delete operation: ${sourceRelativePath}`)
            await ginkoProcessor.rebuild()
            return
          }
          // remove the old file from our output directory
          await this.fileSystem.deleteFile(cacheItem.targetPath)

          await this.cacheService.removeCacheItem(sourceRelativePath)
          break
        }

        case 'modify': {
          const cacheItem = this.cacheService.getCacheItemBySourcePath(sourceRelativePath)
          if (!cacheItem) {
            console.warn(`Asset not found in cache during delete operation: ${sourceRelativePath}`)
            await ginkoProcessor.rebuild()
            return
          }

          const { outputRelativePath, uid } = await this.fileSystem.getAssetOutputPath(sourceRelativePath)
          if (!settings.paths.vaultPath) {
            throw new Error('Vault path is not configured')
          }
          const sourcePath = path.join(settings.paths.vaultPath, sourceRelativePath)

          // Delete the old file
          await this.fileSystem.deleteFile(cacheItem.targetPath)
          this.cacheService.removeCacheItem(sourceRelativePath)

          // Copy the new file
          if (!settings.paths.websitePath) {
            throw new Error('Website path is not configured')
          }
          await this.fileSystem.copyFile(sourcePath, path.join(settings.paths.websitePath, outputRelativePath))

          // Get image dimensions before adding to cache
          const size = this.isImage(sourcePath) ? await this.getImageDimensions(sourcePath) : undefined

          this.cacheService.addCacheItem({
            id: uid,
            sourcePaths: [sourceRelativePath],
            targetPath: outputRelativePath,
            size,
          })
          await ginkoProcessor.rebuildMarkdown()
          break
        }

        // Since the content should not change, we can just update the cache item without any file operations
        case 'rename': {
          if (!oldRelativePath) {
            console.warn('Rename operation missing oldPath:', sourceRelativePath)
            throw new Error('Rename operation missing oldPath')
          }
          await this.cacheService.updateCacheItem(oldRelativePath, sourceRelativePath)

          break
        }
      }
    }
    catch (error) {
      console.warn(`Error handling asset operation ${actionType} for ${sourceRelativePath}:`, error)
      throw error
    }
  }
}
