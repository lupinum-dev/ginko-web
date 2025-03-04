# Ginko Processor Component Analysis

## Overview

The GinkoProcessor is the core component of the Ginko Web plugin, responsible for transforming Obsidian vault content into web-compatible formats. It manages file processing tasks, handles different file types, and coordinates the conversion process according to the selected framework.

## Key Files

- **GinkoProcessor.ts**: Main processor implementation
- **useGinkoProcessor.ts**: Vue composable for global processor access
- **BatchProcessor.ts**: Handles processing files in batches
- **TaskQueue.ts**: Manages the queue of processing tasks
- **FileTypeDetector.ts**: Determines how files should be processed
- **FileSystemService.ts**: Handles file system operations

## Class Structure

```typescript
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
    framework: Framework = 'nuxt',
  ) {
    // Initialize services
  }
  
  // Methods for processing files
}
```

## Core Functionality

### Task Management

```typescript
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
```

### Batch Processing

```typescript
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
```

### Rebuild Operations

```typescript
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

    // Process each file based on rebuild type
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
```

## Global Access with Composable

The processor is made globally available through a Vue composable:

```typescript
// Create a context for GinkoProcessor
const ginkoContext = createContext<GinkoProcessor>()

// Export the use function
export const useGinkoProcessor = ginkoContext.use

// Initialize function to be called once from main.ts
export function initializeGinkoProcessor(
  app: App,
  settings: GinkoWebSettings,
  framework: Framework = 'nuxt',
): GinkoProcessor {
  // Create new instance if none exists
  if (!ginkoContext.tryUse()) {
    const processor = new GinkoProcessor(app, settings, framework)
    ginkoContext.set(processor)
  }

  return ginkoContext.use()
}
```

## Processing Flow

1. **File Change Detection**: Obsidian events trigger the processor
2. **Task Creation**: A task is created with file path, action, and type
3. **Batching**: Tasks are grouped for efficient processing
4. **Processing**: Framework-specific handlers process each file
5. **Output Generation**: Processed content is written to output paths

## Integration with Other Components

### Settings Integration

```typescript
public updateSettings(settings: GinkoWebSettings): void {
  // Deep copy the settings to avoid reference issues
  this.settings = JSON.parse(JSON.stringify(settings))

  // Update dependent services
  this.exclusionService.updatePatterns(this.settings)
}
```

### Framework Integration

The processor adapts to different frameworks:

```typescript
constructor(
  private app: App,
  private settings: GinkoWebSettings,
  framework: Framework = 'nuxt',
) {
  this.fileTypeDetector = new FileTypeDetector(framework)
  this.taskQueue = new TaskQueue()
  this.batchProcessor = new BatchProcessor(this.taskQueue, framework)
  this.cacheService = new CacheService()
  this.fileSystemService = new FileSystemService()
  this.exclusionService = new ExclusionService(settings)
}
```

## Task Queue Management

The TaskQueue manages task priorities and processing order:

```typescript
// Inside TaskQueue class
public addTask(task: ProcessingTask): void {
  // Check if task already exists
  const existingTask = this.tasks.find(t => 
    t.path === task.path && t.action === task.action
  )
  
  if (existingTask) {
    // Update existing task
    Object.assign(existingTask, task)
  } else {
    // Add new task to queue
    this.tasks.push(task)
  }
}

public getNextBatch(batchSize: number = 10): ProcessingTask[] {
  // Sort tasks by priority/timestamp
  this.tasks.sort((a, b) => a.timestamp - b.timestamp)
  
  // Return next batch
  return this.tasks.splice(0, batchSize)
}
```

## Performance Considerations

- Batch processing reduces overhead for multiple file changes
- Task prioritization ensures critical files are processed first
- Caching prevents redundant processing of unchanged files
- Exclusion patterns filter out irrelevant files before processing