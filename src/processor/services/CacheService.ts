import fs from 'node:fs/promises'
import { imageMeta } from 'image-meta'

interface ImageSize {
  width: number
  height: number
}

interface AssetCacheItem {
  id: string
  sourcePaths: string[]
  targetPath: string
  lastModified: number
  size?: ImageSize
}

interface GalleryImage {
  id: string
  size: ImageSize
  targetPath: string

  sourceRelativePath: string
}

export interface GalleryItem {
  // '_id' instead of 'id' is used otherwise it conflicts with the 'id' provided by nuxt Content
  _id: string
  name?: string
  children: GalleryImage[]
}

interface MetaCacheItem {
  sourcePath: string
  slug: {
    default: string
    [key: string]: string
  }
}

interface CacheStructure {
  assets: AssetCacheItem[]
  galleries: GalleryItem[]
  meta: MetaCacheItem[]
}

export class CacheService {
  private readonly CACHE_KEY = 'ginkoCache'

  private getCache(): CacheStructure {
    const cacheData = localStorage.getItem(this.CACHE_KEY)
    return cacheData ? JSON.parse(cacheData) : { assets: [], galleries: [], meta: [] }
  }

  private saveCache(cache: CacheStructure): void {
    localStorage.setItem(this.CACHE_KEY, JSON.stringify(cache))
  }

  // Asset methods
  getCacheItemById(id: string): AssetCacheItem | null {
    const cache = this.getCache()
    return cache.assets.find(item => item.id === id) ?? null
  }

  getCacheItemBySourcePath(sourcePath: string): AssetCacheItem | null {
    const cache = this.getCache()
    return cache.assets.find(item => item.sourcePaths.includes(sourcePath)) ?? null
  }

  addCacheItem(item: Omit<AssetCacheItem, 'lastModified'>): void {
    const cache = this.getCache()
    const existingItem = cache.assets.find(cacheItem => cacheItem.id === item.id)

    if (existingItem) {
      existingItem.sourcePaths = [...new Set([...existingItem.sourcePaths, ...item.sourcePaths])]
      existingItem.lastModified = Date.now()
      cache.assets = cache.assets.filter(cacheItem =>
        cacheItem.id !== item.id || cacheItem === existingItem,
      )
    }
    else {
      cache.assets.push({
        ...item,
        lastModified: Date.now(),
      })
    }
    this.saveCache(cache)
  }

  // Gallery methods
  galleries = {
    addGalleryImage: async (
      galleryId: string,
      galleryName: string | undefined,
      imageId: string,
      targetPath: string,
      sourcePath: string,
      sourceRelativePath: string,
      size?: ImageSize,
    ): Promise<void> => {
      try {
        const cache = this.getCache()

        // Only read file and get metadata if size is not provided
        let imageSize = size
        if (!imageSize) {
          const imageBuffer = await fs.readFile(sourcePath)
          const meta = imageMeta(imageBuffer)
          imageSize = {
            width: meta.width || 0,
            height: meta.height || 0,
          }
        }

        const galleryImage: GalleryImage = {
          id: imageId,
          size: imageSize,
          targetPath,
          sourceRelativePath,
        }

        const existingGallery = cache.galleries.find(g => g._id === galleryId)
        if (existingGallery) {
          existingGallery.children.push(galleryImage)
          if (galleryName)
            existingGallery.name = galleryName
        }
        else {
          cache.galleries.push({
            _id: galleryId,
            name: galleryName,
            children: [galleryImage],
          })
        }

        this.saveCache(cache)
      }
      catch (error) {
        console.error('Failed to add gallery image:', error)
        throw error
      }
    },

    removeGalleryImage: (imageId: string): void => {
      const cache = this.getCache()

      // Find and remove the image from all galleries
      cache.galleries = cache.galleries.map(gallery => ({
        ...gallery,
        children: gallery.children.filter(img => img.id !== imageId),
      })).filter(gallery => gallery.children.length > 0) // Remove empty galleries

      this.saveCache(cache)
    },

    updateGalleryImage: (oldSourcePath: string, newSourcePath: string): void => {
      const cache = this.getCache()

      // Extract gallery IDs from paths to check if we need to move between galleries
      const oldGalleryId = oldSourcePath.match(/_galleries\/[^-\s]+(?:\s*-\s*([^+\s]+)\+)?/)?.[1]
      const newGalleryId = newSourcePath.match(/_galleries\/[^-\s]+(?:\s*-\s*([^+\s]+)\+)?/)?.[1]

      // If gallery IDs are the same, just update the sourceRelativePath
      if (oldGalleryId === newGalleryId) {
        cache.galleries = cache.galleries.map(gallery => ({
          ...gallery,
          children: gallery.children.map(img =>
            img.sourceRelativePath === oldSourcePath
              ? { ...img, sourceRelativePath: newSourcePath }
              : img,
          ),
        }))
      }
      else {
        // If gallery IDs are different, we need to move the image to the new gallery
        // First, find the image in the old gallery
        let movedImage: GalleryImage | undefined

        cache.galleries = cache.galleries.map((gallery) => {
          const imageToMove = gallery.children.find(img => img.sourceRelativePath === oldSourcePath)
          if (imageToMove) {
            movedImage = { ...imageToMove, sourceRelativePath: newSourcePath }
            return {
              ...gallery,
              children: gallery.children.filter(img => img.sourceRelativePath !== oldSourcePath),
            }
          }
          return gallery
        }).filter(gallery => gallery.children.length > 0) // Remove empty galleries

        // If we found the image, add it to the new gallery
        if (movedImage && newGalleryId) {
          const targetGallery = cache.galleries.find(g => g.id === newGalleryId)
          if (targetGallery) {
            targetGallery.children.push(movedImage)
          }
          else {
            // Create new gallery if it doesn't exist
            const galleryName = newSourcePath.match(/_galleries\/([^-\s]+)/)?.[1]
            cache.galleries.push({
              id: newGalleryId,
              name: galleryName,
              children: [movedImage],
            })
          }
        }
      }

      this.saveCache(cache)
    },

    getAllGalleries: async (): Promise<GalleryItem[]> => {
      const cache = this.getCache()
      return cache.galleries
    },
  }

  removeCacheItem(sourcePath: string): void {
    const cache = this.getCache()
    const itemIndex = cache.assets.findIndex(item =>
      item.sourcePaths.includes(sourcePath),
    )

    if (itemIndex !== -1) {
      const item = cache.assets[itemIndex]
      if (item.sourcePaths.length > 1) {
        // Remove only the specified sourcePath
        item.sourcePaths = item.sourcePaths.filter(path => path !== sourcePath)
        item.lastModified = Date.now()
      }
      else {
        // Remove the entire item if it's the last sourcePath
        cache.assets.splice(itemIndex, 1)
      }
      this.saveCache(cache)
    }
  }

  updateCacheItem(oldPath: string, newPath: string): void {
    const cache = this.getCache()
    const item = cache.assets.find(item => item.sourcePaths.includes(oldPath))
    if (item) {
      item.sourcePaths = [...new Set([...item.sourcePaths, newPath])]
      this.saveCache(cache)
    }
  }

  clearCache(): void {
    localStorage.removeItem(this.CACHE_KEY)
    console.log('🧹 Cleared existing cache')
  }

  public async exportCacheToFile(vault: Vault): Promise<void> {
    try {
      const cache = this.getCache()
      const formattedCache = JSON.stringify(cache, null, 2) // Pretty print with 2 spaces

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const fileName = `ginko-cache.json`

      // Use Obsidian's vault API to create or overwrite the file
      const existingFile = vault.getAbstractFileByPath(fileName)
      if (existingFile) {
        await vault.modify(existingFile, formattedCache)
      }
      else {
        await vault.create(fileName, formattedCache)
      }
      console.log(`✅ Cache exported successfully to ${fileName}`)
    }
    catch (error) {
      console.error('❌ Failed to export cache:', error)
      throw error
    }
  }

  // Add meta methods
  meta = {
    addMetaItem: (item: MetaCacheItem): void => {
      const cache = this.getCache()
      const existingIndex = cache.meta.findIndex(m => m.sourcePath === item.sourcePath)

      if (existingIndex !== -1) {
        cache.meta[existingIndex] = item
      }
      else {
        cache.meta.push(item)
      }

      this.saveCache(cache)
    },

    getMetaItem: (sourcePath: string): MetaCacheItem | null => {
      const cache = this.getCache()
      return cache.meta.find(item => item.sourcePath === sourcePath) ?? null
    },

    getAllMeta: (): MetaCacheItem[] => {
      const cache = this.getCache()
      return cache.meta
    },
  }

  findMatchingMetaItems(pathsToCheck: string[]): MetaItem[] {
    const cachedMetaItems = this.meta.getAllMeta()

    return cachedMetaItems.filter(metaItem =>
      pathsToCheck.includes(metaItem.sourcePath,
      ),
    )
  }
}
