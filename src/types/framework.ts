import type { FileTypeCheck } from '../processor/configs/nuxt/fileTypes'

export type Framework = 'nuxt' | 'astro'

export interface FrameworkConfig {
  fileTypes: FileTypeCheck[]
  taskProcessor: TaskProcessor
  paths: Record<string, string>
}

export interface TaskProcessor {
  processTask: (batch: BatchedTask) => Promise<void>
}

export interface BatchCompletionHandler {
  afterCompletion?: (batch: BatchedTask) => Promise<void>
}

export interface BatchedTask {
  fileType: string
  action: string
  files: string[]
}
