import type { BatchCompletionHandler, TaskProcessor } from '../../../types/framework'
import type { BatchedTask } from '../../../types/ginko'
import { nuxtFileTypes } from './fileTypes'
import { AssetHandler } from './handlers/AssetHandler'
import { GalleryHandler } from './handlers/GalleryHandler'
import { MarkdownHandler } from './handlers/MarkdownHandler'
import { MetaHandler } from './handlers/MetaHandler'
import { OtherHandler } from './handlers/OtherHandler'

export interface FileHandler extends BatchCompletionHandler {
  handle: (eventType: string, sourcePath: string, oldPath?: string) => Promise<void>
  afterCompletion?: (batch: BatchedTask) => Promise<void>
}

export class NuxtTaskProcessor implements TaskProcessor {
  private handlers: Map<string, FileHandler>

  constructor() {
    this.handlers = new Map<string, FileHandler>([
      ['asset', new AssetHandler()],
      ['galleryFile', new GalleryHandler()],
      ['meta', new MetaHandler()],
      ['markdown', new MarkdownHandler()],
      ['other', new OtherHandler()],
    ])
  }

  async processTask(batch: BatchedTask): Promise<void> {
    const startTime = performance.now()
    console.log('🟡 Processing Nuxt task:', {
      action: batch.action,
      fileType: batch.fileType,
      paths: batch.files,
      oldPath: batch.oldPath,
    })

    try {
      // Sort meta files by path length - longest first for deletes, shortest first for other actions
      const filesToProcess = batch.fileType === 'meta'
        ? [...batch.files].sort((a, b) => a.length - b.length, // Shortest first for other actions
        )
        : batch.files

      for (const path of filesToProcess) {
        await this.processFile(path, batch.action, batch.oldPath)
      }

      const duration = (performance.now() - startTime).toFixed(2)
      console.log('🟢 Completed Nuxt task:', {
        action: batch.action,
        fileType: batch.fileType,
        processedFiles: batch.files.length,
        duration: `${duration}ms`,
      })

      // Call completion handler if it exists
      const fileType = this.detectFileType(batch.files[0])
      const handler = this.handlers.get(fileType)

      if (handler?.afterCompletion) {
        await handler.afterCompletion(batch)
      }
    }
    catch (error) {
      console.error('🔴 Error processing Nuxt task:', error)
      throw error
    }
  }

  private async processFile(sourcePath: string, action: string, oldPath?: string): Promise<void> {
    const fileType = this.detectFileType(sourcePath)
    const handler = this.handlers.get(fileType)

    if (!handler) {
      throw new Error(`No handler found for file type: ${fileType}`)
    }

    await handler.handle(action, sourcePath, oldPath)
  }

  private detectFileType(path: string): string {
    const fileType = nuxtFileTypes.find(type => type.check(path))
    return fileType?.type || 'other'
  }
}
