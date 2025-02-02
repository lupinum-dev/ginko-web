import type { GinkoWebSettings } from '../../../../settings/settingsTypes'
import type { BatchedTask } from '../../../../types/framework'
import type { GalleryItem } from '../../../services/CacheService'
import type { FileHandler } from '../NuxtTaskProcessor'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { imageMeta } from 'image-meta'
import { useGinkoProcessor } from '../../../../composables/useGinkoProcessor'
import { useGinkoSettings } from '../../../../composables/useGinkoSettings'
import { CacheService } from '../../../services/CacheService'
import { FileSystemService } from '../../../services/FileSystemService'

function extractGalleryInfo(sourcePath: string): { id: string, name: string | undefined } {
  const regex = /_galleries\/([^-\s]+)(?:\s*-\s*([^+\s]+)\+)?/
  const match = sourcePath.match(regex)

  if (!match)
    return { id: '', name: undefined }
  return {
    name: match[1],
    id: match[2] || '',
  }
}

export class GalleryHandler implements FileHandler {
  private fileSystem: FileSystemService
  private cacheService: CacheService
  private outputBasePath: string
  private sourceBasePath: string

  constructor() {
    this.fileSystem = new FileSystemService()
    this.cacheService = new CacheService()
  }

  private async processImageForGallery(sourcePath: string): Promise<{ width: number, height: number } | undefined> {
    const ext = path.extname(sourcePath).toLowerCase()
    const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tiff', '.ico', '.heic', '.heif', '.avif'])

    if (!imageExtensions.has(ext)) {
      return undefined
    }

    try {
      const imageBuffer = await fs.readFile(sourcePath)
      const meta = imageMeta(imageBuffer)

      if (!meta?.width || !meta?.height) {
        return undefined
      }

      return {
        width: meta.width,
        height: meta.height,
      }
    }
    catch (error) {
      console.debug(`Unable to get dimensions for ${sourcePath}:`, error)
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
          const targetPath = path.join(settings.paths.websitePath, outputRelativePath)

          // Copy the file first
          await this.fileSystem.copyFile(sourcePath, targetPath)

          // Get image dimensions only if it's an image file
          const size = await this.processImageForGallery(sourcePath)

          // Add to assets cache
          await this.cacheService.addCacheItem({
            id: uid,
            sourcePaths: [sourceRelativePath],
            targetPath: outputRelativePath,
            size,
          })

          // Extract gallery info and add to gallery cache
          const { id: galleryId, name: galleryName } = extractGalleryInfo(sourceRelativePath)
          if (galleryId) {
            await this.cacheService.galleries.addGalleryImage(
              galleryId,
              galleryName,
              uid,
              outputRelativePath,
              sourcePath,
              sourceRelativePath,
              size, // Pass the size directly since we already have it
            )
          }
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

          // Remove from asset cache
          await this.cacheService.removeCacheItem(sourceRelativePath)

          // Remove from gallery cache if it's a gallery image
          const { id: galleryId } = extractGalleryInfo(sourceRelativePath)
          if (galleryId) {
            await this.cacheService.galleries.removeGalleryImage(cacheItem.id)
          }
          break
        }

        case 'modify': {
          const { outputRelativePath, uid } = await this.fileSystem.getAssetOutputPath(sourceRelativePath)
          if (!settings.paths.vaultPath || !settings.paths.websitePath) {
            throw new Error('Vault path or website path is not configured')
          }
          const sourcePath = path.join(settings.paths.vaultPath, sourceRelativePath)
          const targetPath = path.join(settings.paths.websitePath, outputRelativePath)

          const cacheItem = this.cacheService.getCacheItemBySourcePath(sourceRelativePath)
          if (!cacheItem) {
            console.warn(`Asset not found in cache during modify operation: ${sourceRelativePath}`)
            await ginkoProcessor.rebuild()
            return
          }

          // Delete old file and remove from cache
          await this.fileSystem.deleteFile(cacheItem.targetPath)
          this.cacheService.removeCacheItem(sourceRelativePath)

          // Copy new file
          await this.fileSystem.copyFile(sourcePath, targetPath)

          // Get new size information
          const size = await this.processImageForGallery(sourcePath)

          // Add to asset cache with new size
          this.cacheService.addCacheItem({
            id: uid,
            sourcePaths: [sourceRelativePath],
            targetPath: outputRelativePath,
            size,
          })

          // Update gallery cache
          const { id: galleryId, name: galleryName } = extractGalleryInfo(sourceRelativePath)
          if (galleryId) {
            await this.cacheService.galleries.addGalleryImage(
              galleryId,
              galleryName,
              uid,
              outputRelativePath,
              sourcePath,
              sourceRelativePath,
              size,
            )
          }
          break
        }

        // Since the content should not change, we can just update the cache item without any file operations
        case 'rename': {
          if (!oldRelativePath) {
            console.warn('Rename operation missing oldPath:', sourceRelativePath)
            throw new Error('Rename operation missing oldPath')
          }

          // Update the asset cache
          await this.cacheService.updateCacheItem(oldRelativePath, sourceRelativePath)

          // Check if this is a gallery image
          const oldGalleryInfo = extractGalleryInfo(oldRelativePath)
          const newGalleryInfo = extractGalleryInfo(sourceRelativePath)

          if (oldGalleryInfo.id || newGalleryInfo.id) {
            const cacheItem = this.cacheService.getCacheItemBySourcePath(sourceRelativePath)
            if (!cacheItem) {
              console.warn(`Asset not found in cache during rename operation: ${sourceRelativePath}`)
              await ginkoProcessor.rebuild()
              return
            }

            // Update the gallery cache
            this.cacheService.galleries.updateGalleryImage(oldRelativePath, sourceRelativePath)
          }

          break
        }
      }
    }
    catch (error) {
      console.warn(`Error handling gallery operation ${actionType} for ${sourceRelativePath}:`, error)
      throw error
    }
  }

  async afterCompletion(batch: BatchedTask): Promise<void> {
    // #TODO can be improved by alot, to fine grain handle each gallery dont delete all... currently not worth it (~1.6ms)
    const startTime = performance.now()
    if (batch.fileType !== 'galleryFile' && batch.fileType !== 'galleryFolder') {
      return
    }
    const settings: GinkoWebSettings = useGinkoSettings()
    if (!settings.paths.websitePath) {
      throw new Error('Website path is not configured')
    }
    const galleryOutputPath = path.join(settings.paths.websitePath, 'content/_galleries/')

    try {
      await this.processGalleryOutput(galleryOutputPath)
    }
    catch (error) {
      console.error('Failed to process gallery output:', error)
      throw error
    }
  }

  private async processGalleryOutput(outputPath: string): Promise<void> {
    await this.fileSystem.ensureDir(outputPath)
    await this.clearExistingGalleryFiles(outputPath)

    const galleries = await this.cacheService.galleries.getAllGalleries()
    await this.writeGalleryFiles(outputPath, galleries)
  }

  private async clearExistingGalleryFiles(outputPath: string): Promise<void> {
    const existingFiles = await this.fileSystem.readdir(outputPath)
    const jsonFiles = existingFiles.filter(file => file.endsWith('.json'))

    await Promise.all(
      jsonFiles.map(file =>
        this.fileSystem.deleteFile(path.join(outputPath, file)),
      ),
    )
  }

  private async writeGalleryFiles(outputPath: string, galleries: GalleryItem[]): Promise<void> {
    // Write individual gallery files
    await Promise.all(
      galleries.map(gallery => this.writeGalleryFile(outputPath, gallery)),
    )
  }

  private async writeGalleryFile(outputPath: string, gallery: GalleryItem): Promise<void> {
    const extractPrefix = (path: string): number => {
      const filename = path.split('/').pop() || ''
      const match = filename.match(/^(\d+)\./)
      return match ? Number.parseInt(match[1]) : Infinity
    }

    const galleryData = {
      _id: gallery._id,
      name: gallery.name,
      children: gallery.children
        .sort((a, b) => {
          const prefixA = extractPrefix(a.sourceRelativePath)
          const prefixB = extractPrefix(b.sourceRelativePath)

          // If both have numeric prefixes, sort by them
          if (prefixA !== Infinity || prefixB !== Infinity) {
            return prefixA - prefixB
          }

          // Otherwise fall back to alphabetical sort
          return a.sourceRelativePath.localeCompare(b.sourceRelativePath)
        })
        .map(child => ({
          _id: child.id,
          ...child,
        })),
    }

    const filePath = path.join(outputPath, `${gallery._id}.json`)
    await this.fileSystem.writeFile(
      filePath,
      JSON.stringify(galleryData, null, 2),
    )
  }
}
