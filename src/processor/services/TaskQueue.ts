import { Task, BatchedTask, FileAction } from '../types/ginko'

export class TaskQueue {
  private pendingTasks: Task[] = []
  private processingTasks: Set<string> = new Set()
  private taskRetries: Map<string, number> = new Map()
  private readonly MAX_RETRIES = 3

  public addTask(task: Task): void {
    const taskKey = this.getTaskKey(task.path, task.action)
    
    if (this.processingTasks.has(taskKey)) {
      console.log(taskKey)
      console.log('Skipping duplicate task:', {
        path: task.path,
        action: task.action,
        fileType: task.fileType,
        oldPath: task.oldPath
      })
      return
    }

    if (!this.taskRetries.has(taskKey)) {
      this.taskRetries.set(taskKey, 0)
    }

    console.log('Adding task:', {
      path: task.path,
      action: task.action,
      fileType: task.fileType,
      oldPath: task.oldPath,
      retries: this.taskRetries.get(taskKey)
    })

    this.pendingTasks.push(task)
  }

  public getBatchedTasks(): BatchedTask[] {
    const batches = new Map<string, BatchedTask>()

    for (const task of this.pendingTasks) {
      const batchKey = `${task.action}-${task.fileType}`
      const taskKey = this.getTaskKey(task.path, task.action)
      
      if (this.processingTasks.has(taskKey)) continue

      const retries = this.taskRetries.get(taskKey) || 0
      if (retries >= this.MAX_RETRIES) {
        this.handleMaxRetriesReached(task, taskKey)
        continue
      }

      this.addTaskToBatch(task, batchKey, taskKey, batches)
    }

    return Array.from(batches.values())
  }

  public markTaskAsProcessed(path: string, action: FileAction): void {
    const taskKey = this.getTaskKey(path, action)
    this.pendingTasks = this.pendingTasks.filter(task => 
      this.getTaskKey(task.path, task.action) !== taskKey
    )
    this.cleanupTask(taskKey)
  }

  public incrementRetryCount(path: string, action: FileAction): number {
    const taskKey = this.getTaskKey(path, action)
    const retries = (this.taskRetries.get(taskKey) || 0) + 1
    this.taskRetries.set(taskKey, retries)
    this.processingTasks.delete(taskKey)
    return retries
  }

  public hasPendingTasks(): boolean {
    return this.pendingTasks.length > 0
  }

  private getTaskKey(path: string, action: FileAction): string {
    return `${action}-${path}`
  }

  private cleanupTask(taskKey: string): void {
    this.processingTasks.delete(taskKey)
    this.taskRetries.delete(taskKey)
  }

  private handleMaxRetriesReached(task: Task, taskKey: string): void {
    console.warn(`Max retries reached for task, skipping:`, {
      path: task.path,
      action: task.action,
      fileType: task.fileType,
      oldPath: task.oldPath,
      retries: this.taskRetries.get(taskKey)
    })
    this.pendingTasks = this.pendingTasks.filter(t => 
      this.getTaskKey(t.path, t.action) !== taskKey
    )
    this.cleanupTask(taskKey)
  }

  private addTaskToBatch(
    task: Task, 
    batchKey: string, 
    taskKey: string, 
    batches: Map<string, BatchedTask>
  ): void {
    if (!batches.has(batchKey)) {
      batches.set(batchKey, {
        action: task.action,
        fileType: task.fileType || 'other',
        files: [],
        timestamp: task.timestamp,
        oldPath: task.oldPath
      })
    }

    const batch = batches.get(batchKey)!
    batch.files.push(task.path)
    this.processingTasks.add(taskKey)
  }

  public clear(): void {
    this.pendingTasks = []
    this.processingTasks.clear()
    this.taskRetries.clear()
    console.log('🧹 Cleared existing queue')
  }
} 