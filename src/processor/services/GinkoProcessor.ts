import type { App } from 'obsidian'
import type { GinkoWebSettings } from '../../settings/settingsTypes'
import type { Framework } from '../../types/framework'
import type { FileAction } from '../../types/ginko'
import { Notice } from 'obsidian'
import { useFileType } from '../../composables/useFileType'
import { isSetupComplete } from '../../settings/settingsTypes'
import { BatchProcessor } from './BatchProcessor'
import { CacheService } from './CacheService'
import { ExclusionService } from './ExclusionService'
import { FileSystemService } from './FileSystemService'
import { FileTypeDetector } from './FileTypeDetector'
import { TaskQueue } from './TaskQueue'

type RebuildType = 'assets' | 'markdown' | 'all'

export class GinkoProcessor {
  private batchTimeout: NodeJS.Timeout | null = null
  private isProcessing = false
  private readonly BATCH_DELAY = 1000
  private fileTypeDetector: FileTypeDetector
  private taskQueue: TaskQueue
  private batchProcessor: BatchProcessor
  private cacheService: CacheService
  private fileSystemService: FileSystemService
  private exclusionService: ExclusionService

  constructor(
    private app: App,
    private settings: GinkoWebSettings,
    framework: Framework = settings.paths.template,
  ) {
    this.fileTypeDetector = new FileTypeDetector(framework)
    this.taskQueue = new TaskQueue()
    this.batchProcessor = new BatchProcessor(this.taskQueue, framework)
    this.cacheService = new CacheService()
    this.fileSystemService = new FileSystemService()
    this.exclusionService = new ExclusionService(settings)
  }

  /**
   * Update the processor's settings and all dependent services
   */
  public updateSettings(settings: GinkoWebSettings): void {
    // Deep copy the settings to avoid reference issues
    this.settings = JSON.parse(JSON.stringify(settings))

    // Update dependent services
    this.exclusionService.updatePatterns(this.settings)
  }

  private showNotice(message: string): void {
    const notice = new Notice(message)
    notice.noticeEl.addClass('ginko-web-notice')
  }

  public addTask(path: string, action: FileAction, oldPath?: string): void {
    // Check if Ginko is properly configured
    if (!isSetupComplete(this.settings)) {
      console.error('Ginko is not fully configured. Skipping file processing.')
      this.showNotice('⚠️ Ginko is not fully configured. Please complete the setup in settings.')
      return
    }

    // Skip if path is excluded
    if (this.exclusionService.isExcluded(path)) {
      return
    }

    // For rename operations, also check if the old path was excluded
    if (action === 'rename' && oldPath && this.exclusionService.isExcluded(oldPath)) {
      return
    }

    const fileType = this.fileTypeDetector.detectFileType(path)
    this.taskQueue.addTask({
      path,
      action,
      fileType,
      timestamp: Date.now(),
      oldPath,
    })

    this.scheduleBatchProcessing()
  }

  private scheduleBatchProcessing(): void {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout)
    }

    this.batchTimeout = setTimeout(() => {
      this.processBatch()
    }, this.BATCH_DELAY)
  }

  private async processBatch(): Promise<void> {
    if (this.isProcessing || !this.taskQueue.hasPendingTasks())
      return

    try {
      this.isProcessing = true
      await this.batchProcessor.processBatches()

      if (this.taskQueue.hasPendingTasks()) {
        this.scheduleBatchProcessing()
      }
    }
    finally {
      this.isProcessing = false
    }
  }

  private async rebuildByType(type: RebuildType): Promise<void> {
    try {
      // Check if Ginko is properly configured
      if (!isSetupComplete(this.settings)) {
        console.warn('Ginko is not fully configured. Skipping rebuild.')
        this.showNotice('⚠️ Ginko is not fully configured. Please complete the setup in settings.')
        return
      }

      const { detectFileType } = useFileType()

      // Clear existing queue and cache if rebuilding all
      this.taskQueue.clear()
      if (type === 'all') {
        this.cacheService.clearCache()
        await this.fileSystemService.resetOutputDirectory()
      }

      // Get target path from settings
      if (!this.settings.paths.websitePath) {
        throw new Error('Output directory path is not set in settings.')
      }
      const targetPath = this.settings.paths.websitePath

      // Get all files from the vault
      const files = this.app.vault.getFiles()

      // Process each file
      for (const file of files) {
        // Skip files in the target output directory
        if (file.path.startsWith(targetPath)) {
          if (type === 'all')
            continue
        }

        // Skip excluded files
        if (this.exclusionService.isExcluded(file.path)) {
          continue
        }

        const fileType = detectFileType(file.path)
        const shouldProcess = type === 'all'
          || (type === 'assets' && (fileType === 'asset' || fileType === 'gallery'))
          || (type === 'markdown' && fileType === 'markdown')

        if (shouldProcess) {
          await this.addTask(file.path, 'rebuild')
        }
      }

      // Force immediate processing
      await this.processBatch()
    }
    catch (error) {
      console.error(`❌ Error during ${type} rebuild:`, error)
      throw error
    }
  }

  public async rebuildAssets(): Promise<void> {
    await this.rebuildByType('assets')
  }

  public async rebuildMarkdown(): Promise<void> {
    await this.rebuildByType('markdown')
  }

  public async rebuild(): Promise<void> {
    await this.rebuildByType('all')
  }
}
