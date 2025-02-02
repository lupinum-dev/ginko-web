import type { TaskProcessor } from '../../../types/framework'
import type { BatchedTask } from '../../../types/ginko'

export class AstroTaskProcessor implements TaskProcessor {
  async processTask(batch: BatchedTask): Promise<void> {
    console.log('🔵 Processing Astro task:', {
      action: batch.action,
      fileType: batch.fileType,
      files: batch.files.map(f => f.path),
    })

    // Simulate different processing times for different file types
    const delay = this.getProcessingDelay(batch.fileType)
    await new Promise(resolve => setTimeout(resolve, delay))

    console.log('✅ Completed Astro task:', {
      action: batch.action,
      fileType: batch.fileType,
      processedFiles: batch.files.length,
    })
  }

  private getProcessingDelay(fileType: string): number {
    const delays: Record<string, number> = {
      asset: 1500,
      markdown: 800,
      meta: 400,
      galleryFolder: 1200,
      galleryFile: 600,
      other: 200,
    }
    return delays[fileType] || 800
  }
}
