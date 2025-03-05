import { App, TFile, Notice } from 'obsidian';
import { db, INoteItem, IAssetItem } from '../db';
import { useFileType } from '../composables/useFileType';
import { nanoid } from 'nanoid';

// Cache for file type detection results
const fileTypeCache = new Map<string, string>();

// Cache for file existence checks
const fileExistenceCache = new Map<string, { isNote: boolean, id?: string }>();

// Cache for file content (limited to 100 most recent files)
class ContentCache {
  private cache = new Map<string, { content: string, timestamp: number }>();
  private maxSize = 100;

  set(path: string, content: string): void {
    // If cache is full, remove oldest entry
    if (this.cache.size >= this.maxSize) {
      let oldestPath = '';
      let oldestTime = Date.now();

      for (const [path, entry] of this.cache.entries()) {
        if (entry.timestamp < oldestTime) {
          oldestTime = entry.timestamp;
          oldestPath = path;
        }
      }

      if (oldestPath) {
        this.cache.delete(oldestPath);
      }
    }

    this.cache.set(path, { content, timestamp: Date.now() });
  }

  get(path: string): string | undefined {
    const entry = this.cache.get(path);
    if (entry) {
      // Update timestamp to mark as recently used
      entry.timestamp = Date.now();
      return entry.content;
    }
    return undefined;
  }

  has(path: string): boolean {
    return this.cache.has(path);
  }

  delete(path: string): void {
    this.cache.delete(path);
  }

  clear(): void {
    this.cache.clear();
  }
}

const contentCache = new ContentCache();

/**
 * Service to handle replication of notes and assets in the database
 */
export class DatabaseReplicationService {
  private app: App;
  private fileType = useFileType();
  private perfMetrics: Record<string, number> = {};

  // Optimal batch size based on testing
  private BATCH_SIZE = 2000;

  constructor(app: App) {
    this.app = app;
  }

  /**
   * Process a file based on the action
   */
  async processFile(path: string, action: 'create' | 'modify' | 'delete' | 'rename', oldPath?: string): Promise<void> {
    try {
      switch (action) {
        case 'create':
        case 'modify':
          await this.saveFileToDatabase(path);
          break;
        case 'delete':
          await this.deleteFileFromDatabase(path);
          // Clear caches for this path
          fileTypeCache.delete(path);
          fileExistenceCache.delete(path);
          break;
        case 'rename':
          if (oldPath) {
            await this.handleFileRename(path, oldPath);
            // Update caches
            if (fileTypeCache.has(oldPath)) {
              const fileType = fileTypeCache.get(oldPath);
              fileTypeCache.set(path, fileType!);
              fileTypeCache.delete(oldPath);
            }
            fileExistenceCache.delete(oldPath);
          }
          break;
      }
    } catch (error) {
      console.error(`Error in database replication for ${action} ${path}:`, error);
    }
  }

  /**
   * Read file content with caching
   */
  private async readFileContent(file: TFile): Promise<string> {
    // Check cache first
    if (contentCache.has(file.path)) {
      return contentCache.get(file.path)!;
    }

    // Cache miss, read from disk
    const content = await this.app.vault.read(file);

    // Cache the content
    contentCache.set(file.path, content);

    return content;
  }

  /**
   * Save a file to the database
   */
  private async saveFileToDatabase(path: string): Promise<void> {
    try {
      const file = this.app.vault.getAbstractFileByPath(path);

      if (!(file instanceof TFile)) {
        return;
      }

      const fileContent = await this.readFileContent(file);

      // Use cached file type if available
      let isMarkdown: boolean;
      if (fileTypeCache.has(path)) {
        isMarkdown = fileTypeCache.get(path) === 'markdown';
      } else {
        isMarkdown = this.fileType.detectFileType(path) === 'markdown';
        fileTypeCache.set(path, isMarkdown ? 'markdown' : 'asset');
      }

      if (isMarkdown) {
        // Handle markdown note
        let note = await db.getNoteByPath(path);

        if (!note) {
          // Create new note
          note = {
            id: nanoid(),
            path: path,
            title: file.basename,
            content: fileContent,
            lastModified: file.stat.mtime,
            published: false
          };
          // Update cache
          fileExistenceCache.set(path, { isNote: true, id: note.id });
        } else {
          // Update existing note
          note.title = file.basename;
          note.content = fileContent;
          note.lastModified = file.stat.mtime;
        }

        await db.saveNote(note);
      } else {
        // Handle asset
        let asset = await db.getAssetByPath(path);

        if (!asset) {
          // Create new asset
          asset = {
            id: nanoid(),
            path: path,
            lastModified: file.stat.mtime
          };
          // Update cache
          fileExistenceCache.set(path, { isNote: false, id: asset.id });
        } else {
          // Update existing asset
          asset.lastModified = file.stat.mtime;
        }

        await db.saveAsset(asset);
      }
    } catch (error) {
      console.error(`Failed to save file to database: ${path}`, error);
      throw error;
    }
  }

  /**
   * Delete a file from the database
   */
  private async deleteFileFromDatabase(path: string): Promise<void> {
    try {
      // Check cache first
      if (fileExistenceCache.has(path)) {
        const cacheEntry = fileExistenceCache.get(path)!;
        if (cacheEntry.id) {
          if (cacheEntry.isNote) {
            await db.deleteNote(cacheEntry.id);
          } else {
            await db.deleteAsset(cacheEntry.id);
          }
          fileExistenceCache.delete(path);
          return;
        }
      }

      // Cache miss, check file type and delete accordingly
      const isMarkdown = fileTypeCache.has(path)
        ? fileTypeCache.get(path) === 'markdown'
        : this.fileType.detectFileType(path) === 'markdown';

      if (isMarkdown) {
        // Delete note
        const note = await db.getNoteByPath(path);
        if (note) {
          await db.deleteNote(note.id);
        }
      } else {
        // Delete asset
        const asset = await db.getAssetByPath(path);
        if (asset) {
          await db.deleteAsset(asset.id);
        }
      }

      // Clear caches
      fileTypeCache.delete(path);
      fileExistenceCache.delete(path);
      contentCache.delete(path);
    } catch (error) {
      console.error(`Failed to delete file from database: ${path}`, error);
      throw error;
    }
  }

  /**
   * Handle file rename
   */
  private async handleFileRename(newPath: string, oldPath: string): Promise<void> {
    try {
      // Check if the file exists in the database
      const existingNote = await db.getNoteByPath(oldPath);
      const existingAsset = existingNote ? undefined : await db.getAssetByPath(oldPath);

      if (!existingNote && !existingAsset) {
        // If file doesn't exist in database, just save it as a new file
        await this.saveFileToDatabase(newPath);
        return;
      }

      const file = this.app.vault.getAbstractFileByPath(newPath);
      if (!(file instanceof TFile)) {
        return;
      }

      // Use a transaction to ensure atomicity
      await db.executeTransaction('rw', [db.getNotesTable(), db.getAssetsTable()], async () => {
        if (existingNote) {
          // Update note path
          existingNote.path = newPath;
          existingNote.title = file.basename;
          existingNote.lastModified = file.stat.mtime;
          await db.saveNote(existingNote);

          // Update cache
          fileExistenceCache.set(newPath, { isNote: true, id: existingNote.id });
        } else if (existingAsset) {
          // Update asset path
          existingAsset.path = newPath;
          existingAsset.lastModified = file.stat.mtime;
          await db.saveAsset(existingAsset);

          // Update cache
          fileExistenceCache.set(newPath, { isNote: false, id: existingAsset.id });
        }

        return; // Explicitly return to make it clear this is a void function
      });

      // Remove old path from caches
      fileExistenceCache.delete(oldPath);
    } catch (error) {
      console.error(`Failed to handle file rename: ${oldPath} -> ${newPath}`, error);
      throw error;
    }
  }

  /**
   * Track performance metrics for a specific operation
   */
  private trackPerformance(operation: string, startTime: number): void {
    const duration = Date.now() - startTime;
    if (!this.perfMetrics[operation]) {
      this.perfMetrics[operation] = 0;
    }
    this.perfMetrics[operation] += duration;
  }

  /**
   * Get performance report
   */
  getPerformanceReport(): Record<string, any> {
    return {
      metrics: this.perfMetrics,
      totalTime: Object.values(this.perfMetrics).reduce((sum, time) => sum + time, 0),
    };
  }

  /**
   * Clear performance metrics
   */
  clearPerformanceMetrics(): void {
    this.perfMetrics = {};
  }

  /**
   * Pre-cache file types for all files
   * This can be called before a large sync operation to improve performance
   */
  async precacheFileTypes(): Promise<void> {
    const files = this.app.vault.getFiles();
    const startTime = Date.now();

    // Process in chunks to avoid blocking the UI
    const chunkSize = 500;
    for (let i = 0; i < files.length; i += chunkSize) {
      const chunk = files.slice(i, i + chunkSize);

      // Process chunk
      for (const file of chunk) {
        if (!fileTypeCache.has(file.path)) {
          const isMarkdown = this.fileType.detectFileType(file.path) === 'markdown';
          fileTypeCache.set(file.path, isMarkdown ? 'markdown' : 'asset');
        }
      }

      // Yield to main thread if needed
      if (i + chunkSize < files.length) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    console.log(`Pre-cached file types for ${files.length} files in ${Date.now() - startTime}ms`);
  }

  /**
   * Sync all files in the vault with the database
   */
  async syncAllFiles(): Promise<Record<string, any>> {
    try {
      console.log('Starting full database sync...');
      this.clearPerformanceMetrics();

      const globalStartTime = Date.now();
      const files = this.app.vault.getFiles();
      let processedCount = 0;

      // Pre-cache file types for better performance
      await this.precacheFileTypes();

      // Prepare batches of files
      const batches = [];
      for (let i = 0; i < files.length; i += this.BATCH_SIZE) {
        batches.push(files.slice(i, i + this.BATCH_SIZE));
      }

      // Process files in batches
      for (const batch of batches) {
        const batchStartTime = Date.now();

        // First, categorize files by type
        const markdownPaths: string[] = [];
        const assetPaths: string[] = [];
        const filesByPath: Record<string, TFile> = {};

        // Use cached file types when available
        const fileTypeStartTime = Date.now();
        for (const file of batch) {
          let isMarkdown: boolean;

          if (fileTypeCache.has(file.path)) {
            isMarkdown = fileTypeCache.get(file.path) === 'markdown';
          } else {
            isMarkdown = this.fileType.detectFileType(file.path) === 'markdown';
            fileTypeCache.set(file.path, isMarkdown ? 'markdown' : 'asset');
          }

          if (isMarkdown) {
            markdownPaths.push(file.path);
          } else {
            assetPaths.push(file.path);
          }
          filesByPath[file.path] = file;
        }
        this.trackPerformance('fileTypeDetection', fileTypeStartTime);

        // Batch fetch existing notes and assets
        const dbFetchStartTime = Date.now();
        const existingNotesRecord = markdownPaths.length > 0 ? await db.getNotesByPaths(markdownPaths) : {};
        const existingAssetsRecord = assetPaths.length > 0 ? await db.getAssetsByPaths(assetPaths) : {};
        this.trackPerformance('dbFetch', dbFetchStartTime);

        // Prepare notes and assets for batch update
        const readStartTime = Date.now();
        const notesToSave: INoteItem[] = [];
        const assetsToSave: IAssetItem[] = [];

        // Process markdown files - read all files in parallel
        const markdownReadPromises = markdownPaths.map(async (path) => {
          const file = filesByPath[path];
          return {
            path,
            content: await this.readFileContent(file),
            file
          };
        });

        // Wait for all reads to complete
        const markdownContents = await Promise.all(markdownReadPromises);

        // Process the read results
        for (const { path, content, file } of markdownContents) {
          const note = existingNotesRecord[path];

          if (!note) {
            // Create new note
            const newNote: INoteItem = {
              id: nanoid(),
              path: path,
              title: file.basename,
              content: content,
              lastModified: file.stat.mtime,
              published: false
            };
            notesToSave.push(newNote);
            // Update cache
            fileExistenceCache.set(path, { isNote: true, id: newNote.id });
          } else {
            // Update existing note
            note.title = file.basename;
            note.content = content;
            note.lastModified = file.stat.mtime;
            notesToSave.push(note);
          }
        }

        // Process asset files
        for (const path of assetPaths) {
          const file = filesByPath[path];
          const asset = existingAssetsRecord[path];

          if (!asset) {
            // Create new asset
            const newAsset: IAssetItem = {
              id: nanoid(),
              path: path,
              lastModified: file.stat.mtime
            };
            assetsToSave.push(newAsset);
            // Update cache
            fileExistenceCache.set(path, { isNote: false, id: newAsset.id });
          } else {
            // Update existing asset
            asset.lastModified = file.stat.mtime;
            assetsToSave.push(asset);
          }
        }
        this.trackPerformance('fileReading', readStartTime);

        // Save notes and assets in batch
        const dbSaveStartTime = Date.now();

        // Use a transaction for batch operations
        await db.executeTransaction('rw', [db.getNotesTable(), db.getAssetsTable()], async () => {
          // Save in chunks to avoid transaction size limits
          if (notesToSave.length > 0) {
            await db.saveNotes(notesToSave);
          }

          if (assetsToSave.length > 0) {
            await db.saveAssets(assetsToSave);
          }

          return; // Explicitly return to make it clear this is a void function
        });

        this.trackPerformance('dbSave', dbSaveStartTime);

        // Update processed count
        processedCount += batch.length;

        // Track batch processing time
        this.trackPerformance('batchProcessing', batchStartTime);

        // Log progress for every batch
        console.log(`Database sync progress: ${processedCount}/${files.length} files processed`);
      }

      const globalEndTime = Date.now();
      const duration = (globalEndTime - globalStartTime) / 1000;

      // Generate performance report
      const report = this.getPerformanceReport();
      report.totalFiles = files.length;
      report.totalDuration = duration;
      report.averageTimePerFile = duration * 1000 / files.length;

      console.log(`Database sync completed. ${processedCount} files processed in ${duration} seconds.`);
      console.log('Performance report:', report);

      new Notice(`✅ Database sync completed. ${processedCount} files processed in ${duration} seconds.`);

      return report;
    } catch (error) {
      console.error('Failed to sync all files:', error);
      new Notice('❌ Database sync failed');
      throw error;
    }
  }

  /**
   * Clear all caches
   * This can be useful when memory usage is a concern or when the vault structure has changed significantly
   */
  clearAllCaches(): void {
    fileTypeCache.clear();
    fileExistenceCache.clear();
    contentCache.clear();
    console.log('All caches cleared');
  }
} 