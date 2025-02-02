import type { TaskProcessor } from '../../../types/framework'
import type { BatchedTask } from '../../../types/ginko'

export class AstroTaskProcessor implements TaskProcessor {
  async processTask(batch: BatchedTask): Promise<void> {


    // Simulate different processing times for different file types
    const delay = this.getProcessingDelay(batch.fileType)
    await new Promise(resolve => setTimeout(resolve, delay))


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
