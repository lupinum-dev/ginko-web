import type { FileTypeCheck } from '../configs/nuxt/fileTypes'

export type Framework = 'nuxt' | 'astro'

export type FrameworkConfig = {
  fileTypes: FileTypeCheck[]
  taskProcessor: TaskProcessor
  paths: Record<string, string>
}

export interface TaskProcessor {
  processTask(batch: BatchedTask): Promise<void>
}

export interface BatchCompletionHandler {
  afterCompletion?(batch: BatchedTask): Promise<void>
}

export type BatchedTask = {
  fileType: string
  action: string
  files: string[]
} 