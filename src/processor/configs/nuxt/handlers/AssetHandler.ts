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
  private outputBasePath: string
  private sourceBasePath: string

  constructor() {
    this.fileSystem = new FileSystemService()
    this.cacheService = new CacheService()
  }

  private async getImageDimensions(sourcePath: string) {
    try {
      const imageBuffer = await fs.readFile(sourcePath)
      const meta = imageMeta(imageBuffer)
      return {
        width: meta.width || 0,
        height: meta.height || 0,
      }
    }
    catch (error) {
      console.warn(`Failed to get image dimensions for ${sourcePath}:`, error)
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
          const sourcePath = path.join(settings.paths.vaultPath, sourceRelativePath)

          await this.fileSystem.copyFile(sourcePath, path.join(settings.paths.websitePath, outputRelativePath))

          // Get image dimensions before adding to cache
          const size = await this.getImageDimensions(sourcePath)

          await this.cacheService.addCacheItem({
            id: uid,
            sourcePaths: [sourceRelativePath],
            targetPath: outputRelativePath,
            size, // Add the size property
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
          const sourcePath = path.join(settings.paths.vaultPath, sourceRelativePath)

          // Delete the old file
          await this.fileSystem.deleteFile(cacheItem.targetPath)
          this.cacheService.removeCacheItem(sourceRelativePath)

          // Copy the new file
          await this.fileSystem.copyFile(sourcePath, path.join(settings.paths.websitePath, outputRelativePath))

          // Get image dimensions before adding to cache
          const size = await this.getImageDimensions(sourcePath)

          this.cacheService.addCacheItem({
            id: uid,
            sourcePaths: [sourceRelativePath],
            targetPath: outputRelativePath,
            size, // Add the size property
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
