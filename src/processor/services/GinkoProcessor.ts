import { App } from 'obsidian'
import { GinkoSettings } from '../../utils/types'
import { Framework } from '../types/framework'
import { FileTypeDetector } from './FileTypeDetector'
import { TaskQueue } from './TaskQueue'
import { BatchProcessor } from './BatchProcessor'
import { FileAction } from '../types/ginko'
import { CacheService } from './CacheService'
import { FileSystemService } from './FileSystemService'
import { useFileType } from '../composables/useFileType'

type RebuildType = 'assets' | 'markdown' | 'all';

export class GinkoProcessor {
  private batchTimeout: NodeJS.Timeout | null = null
  private isProcessing = false
  private readonly BATCH_DELAY = 1000
  private fileTypeDetector: FileTypeDetector
  private taskQueue: TaskQueue
  private batchProcessor: BatchProcessor
  private cacheService: CacheService
  private fileSystemService: FileSystemService

  constructor(
    private app: App,
    private settings: GinkoSettings,
    framework: Framework = 'nuxt'
  ) {
    this.fileTypeDetector = new FileTypeDetector(framework)
    this.taskQueue = new TaskQueue()
    this.batchProcessor = new BatchProcessor(this.taskQueue, framework)
    this.cacheService = new CacheService()
    this.fileSystemService = new FileSystemService()
  }

  public addTask(path: string, action: FileAction, oldPath?: string): void {
    const fileType = this.fileTypeDetector.detectFileType(path)
    this.taskQueue.addTask({
      path,
      action,
      fileType,
      timestamp: Date.now(),
      oldPath
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
    if (this.isProcessing || !this.taskQueue.hasPendingTasks()) return

    try {
      this.isProcessing = true
      await this.batchProcessor.processBatches()

      if (this.taskQueue.hasPendingTasks()) {
        this.scheduleBatchProcessing()
      }
    } finally {
      this.isProcessing = false
    }
  }

  private async rebuildByType(type: RebuildType): Promise<void> {
    try {
      const { detectFileType } = useFileType();
      
      // Clear existing queue and cache if rebuilding all
      this.taskQueue.clear();
      if (type === 'all') {
        this.cacheService.clearCache();
        await this.fileSystemService.resetOutputDirectory();
      }
      
      // Get target path from settings
      if (!this.settings.outputDirectoryPath) {
        throw new Error('Output directory path is not set in settings.')
      }
      const targetPath = this.settings.outputDirectoryPath;

      // Get all files from the vault
      const files = this.app.vault.getFiles();
      
      console.log(`🔄 Checking files for ${type} rebuild. Found ${files.length} files`);
      
      // Process each file
      for (const file of files) {
        // Skip files in the target output directory
        if (file.path.startsWith(targetPath)) {
          if (type === 'all') console.log(`⏭️ Skipping output file: ${file.path}`);
          continue;
        }
        
        const fileType = detectFileType(file.path);
        const shouldProcess = type === 'all' || 
          (type === 'assets' && (fileType === 'asset' || fileType === 'gallery')) ||
          (type === 'markdown' && fileType === 'markdown');

        if (shouldProcess) {
          await this.addTask(file.path, 'rebuild');
          console.log(`${this.getLogEmoji(type)} Adding ${type} rebuild task for: ${file.path}`);
        }
      }
      
      // Force immediate processing
      await this.processBatch();
      
      console.log(`✅ ${type.charAt(0).toUpperCase() + type.slice(1)} rebuild tasks completed`);
    } catch (error) {
      console.error(`❌ Error during ${type} rebuild:`, error);
      throw error;
    }
  }

  private getLogEmoji(type: RebuildType): string {
    switch (type) {
      case 'assets': return '📦';
      case 'markdown': return '📝';
      case 'all': return '🔄';
      default: return '📎';
    }
  }

  public async rebuildAssets(): Promise<void> {
    await this.rebuildByType('assets');
  }

  public async rebuildMarkdown(): Promise<void> {
    await this.rebuildByType('markdown');
  }

  public async rebuild(): Promise<void> {
    await this.rebuildByType('all');
  }
} 