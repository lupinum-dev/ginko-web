import type { Framework } from '../types/framework'
import type { BatchedTask } from '../types/ginko'
import type { TaskQueue } from './TaskQueue'
import { fileTypeProcessingOrder } from '../configs/nuxt/fileTypes'
import { FrameworkService } from './FrameworkService'

export class BatchProcessor {
  constructor(
    private taskQueue: TaskQueue,
    private framework: Framework,
  ) {}

  public async processBatches(): Promise<void> {
    const batches = this.taskQueue.getBatchedTasks()
    const config = FrameworkService.getConfig(this.framework)

    this.logBatchProcessing(batches)

    const sortedBatches = this.sortBatchesByProcessingOrder(batches)

    for (const batch of sortedBatches) {
      try {
        await config.taskProcessor.processTask(batch)
        this.handleSuccessfulBatch(batch)
      }
      catch (error) {
        this.handleFailedBatch(batch, error as Error)
      }
    }
  }

  private sortBatchesByProcessingOrder(batches: BatchedTask[]): BatchedTask[] {
    return [...batches].sort((a, b) => {
      const indexA = fileTypeProcessingOrder.indexOf(a.fileType)
      const indexB = fileTypeProcessingOrder.indexOf(b.fileType)
      return indexA - indexB
    })
  }

  private logBatchProcessing(batches: BatchedTask[]): void {
    console.log(`Processing ${batches.length} batches for ${this.framework}:`, {
      batches: batches.map(batch => ({
        action: batch.action,
        fileType: batch.fileType,
        fileCount: batch.files.length,
      })),
    })
  }

  private handleSuccessfulBatch(batch: BatchedTask): void {
    batch.files.forEach((path) => {
      this.taskQueue.markTaskAsProcessed(path, batch.action)
    })
  }

  private handleFailedBatch(batch: BatchedTask, error: Error): void {
    console.error('Failed to process batch:', error)
    batch.files.forEach((path) => {
      const retries = this.taskQueue.incrementRetryCount(path, batch.action)
      console.warn(`Task failed, attempt ${retries}/3:`, {
        path,
        action: batch.action,
        error: error.message,
      })
    })
  }
}
