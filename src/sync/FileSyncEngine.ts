import { App, TFile } from 'obsidian';
import { fileDB, IFileRecord, FileTypeConfig } from './FileDatabase';
import { createHash } from 'crypto';
import { Notice } from 'obsidian';

/**
 * FileState tracks the current state of files for efficient sync
 */
interface FileState {
  hash: string;          // Content hash for quick comparison
  lastSync: number;      // Timestamp of last sync
  syncInProgress: boolean; // Flag to prevent concurrent syncs
  fileType: string;      // Type of file
}

/**
 * FileSyncEngine implements a Two-Phase Sync with Verification approach
 * that can handle multiple file types with different storage requirements
 */
export class FileSyncEngine {
  private app: App;

  // File state tracking
  private fileStates = new Map<string, FileState>();

  // Queue of pending file operations
  private pendingSync = new Set<string>();

  // Global sync state
  private syncing = false;
  private syncTimer: NodeJS.Timeout | null = null;

  // Performance tracking
  private perfMetrics: Record<string, { count: number, totalTime: number }> = {};

  constructor(app: App) {
    this.app = app;

    // Register additional asset pattern
    this.registerFileTypePatterns();
  }

  /**
   * Register file type patterns for detection
   */
  private registerFileTypePatterns(): void {
    // Clear existing patterns as we'll now use the database's filters
    // This method exists mostly for backward compatibility
  }

  /**
   * Determine the file type from the path
   */
  detectFileType(path: string): string | null {
    return fileDB.determineFileType(path);
  }

  /**
   * Initialize the sync engine
   */
  async initialize(): Promise<void> {
    try {
      await fileDB.init();
      console.log('FileSyncEngine initialized');
    } catch (error) {
      console.error('Failed to initialize FileSyncEngine:', error);
      throw error;
    }
  }

  /**
   * Calculate content hash for verification
   */
  private calculateContentHash(content: string): string {
    try {
      return createHash('md5').update(content).digest('hex');
    } catch (error) {
      // Fallback in environments where crypto isn't available
      let hash = 0;
      for (let i = 0; i < content.length; i++) {
        const char = content.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
      }
      return hash.toString(16);
    }
  }

  /**
   * Handle file creation or modification
   */
  async handleFileChange(file: TFile): Promise<void> {
    const fileType = this.detectFileType(file.path);

    // Skip files we don't care about
    if (!fileType) {
      return;
    }

    // Add to pending sync queue
    this.pendingSync.add(file.path);

    // Schedule sync process
    this.scheduleSyncCheck();
  }

  /**
   * Handle file deletion
   */
  async handleFileDelete(path: string): Promise<void> {
    const fileType = this.detectFileType(path);

    // Skip files we don't care about
    if (!fileType) {
      return;
    }

    this.deleteFileFromDatabase(path);
  }

  /**
   * Handle file rename
   */
  async handleFileRename(file: TFile, oldPath: string): Promise<void> {
    const newFileType = this.detectFileType(file.path);
    const oldFileType = this.detectFileType(oldPath);

    // Skip files we don't care about
    if (!newFileType && !oldFileType) {
      return;
    }

    // If file type changed, treat as delete + create
    if (oldFileType && !newFileType) {
      await this.handleFileDelete(oldPath);
      return;
    }

    if (!oldFileType && newFileType) {
      await this.handleFileChange(file);
      return;
    }

    // Otherwise handle as rename
    this.renameFileInDatabase(file, oldPath);
  }

  /**
   * Load all matching files
   */
  async loadAllFiles(fileTypes?: string[]): Promise<void> {
    console.log('Starting initial load of all tracked files...');
    const startTime = performance.now();

    try {
      // Mark sync in progress
      await fileDB.updateSyncState('syncInProgress', 'true');

      // Get all files in the vault
      const files = this.app.vault.getFiles();

      // Determine which file types to process
      const typesToProcess = fileTypes || fileDB.getRegisteredFileTypes();
      console.log(`Processing file types: ${typesToProcess.join(', ')}`);

      // First, identify all tracked files by type
      const filesByType: Record<string, TFile[]> = {};

      for (const file of files) {
        const fileType = this.detectFileType(file.path);
        if (fileType && typesToProcess.includes(fileType)) {
          if (!filesByType[fileType]) {
            filesByType[fileType] = [];
          }
          filesByType[fileType].push(file);
        }
      }

      // Calculate total files to process
      const totalFiles = Object.values(filesByType).reduce(
        (sum, files) => sum + files.length, 0
      );

      console.log(`Found ${totalFiles} files to track (by type): ${Object.entries(filesByType)
        .map(([type, files]) => `${type}: ${files.length}`)
        .join(', ')
        }`);

      // Process each file type separately
      let processedCount = 0;

      for (const [fileType, typeFiles] of Object.entries(filesByType)) {
        console.log(`Processing ${typeFiles.length} ${fileType} files...`);

        // Process in batches to avoid UI freezes
        const batchSize = 2000;

        for (let i = 0; i < typeFiles.length; i += batchSize) {
          const startBatchTime = performance.now();
          const batch = typeFiles.slice(i, i + batchSize);

          // Process batch
          await this.processBatch(batch);

          processedCount += batch.length;
          console.log(`Processed ${processedCount}/${totalFiles} files (${fileType})`);

          // Small pause to let UI breathe
          if (i + batchSize < typeFiles.length) {
            await new Promise(resolve => setTimeout(resolve, 5));
          }

          this.trackPerformance('batchProcessing', startBatchTime);
        }
      }

      // Clean up database - remove entries for files that no longer exist
      await this.cleanupDatabase(typesToProcess);

      // Update last sync timestamp
      await fileDB.updateSyncState('lastFullSync', Date.now().toString());
      await fileDB.updateSyncState('syncInProgress', 'false');

      // Log completion
      const duration = (performance.now() - startTime) / 1000;
      console.log(`Initial file load completed in ${duration.toFixed(2)} seconds`);
      console.log(`Performance metrics:`, this.getPerformanceReport());

      // Show notice to user
      new Notice(`Synchronized ${totalFiles} files (${Object.keys(filesByType).join(', ')})`);
    } catch (error) {
      console.error('Failed to load all files:', error);
      await fileDB.updateSyncState('syncInProgress', 'false');
      throw error;
    }
  }

  /**
   * Clean up database by removing entries for files that no longer exist
   * @param fileTypes Optional list of file types to clean up, if not provided all types will be cleaned
   */
  private async cleanupDatabase(fileTypes?: string[]): Promise<void> {
    try {
      console.log('Starting database cleanup...');
      const startTime = performance.now();

      // Get all files by type if specific types are requested
      let dbPaths: string[] = [];

      if (fileTypes && fileTypes.length > 0) {
        // Get files for each requested type
        for (const fileType of fileTypes) {
          const typeFiles = await fileDB.getFilesByType(fileType);
          dbPaths = dbPaths.concat(typeFiles.map(file => file.path));
        }

        console.log(`Found ${dbPaths.length} entries in database for types: ${fileTypes.join(', ')}`);
      } else {
        // Get all file paths
        dbPaths = await fileDB.getAllFilePaths();
        console.log(`Found ${dbPaths.length} total entries in database`);
      }

      if (dbPaths.length === 0) {
        console.log('No database entries to clean up');
        return;
      }

      // Check which files no longer exist in the vault
      const nonExistentPaths: string[] = [];

      for (const path of dbPaths) {
        const file = this.app.vault.getAbstractFileByPath(path);
        if (!file) {
          nonExistentPaths.push(path);
        }
      }

      console.log(`Found ${nonExistentPaths.length} database entries for files that no longer exist`);

      // Delete entries for non-existent files
      if (nonExistentPaths.length > 0) {
        const deleted = await fileDB.deleteFilesByPaths(nonExistentPaths);
        console.log(`Deleted ${deleted} database entries for non-existent files`);
      }

      // Clear file states for non-existent files
      for (const path of nonExistentPaths) {
        this.fileStates.delete(path);
      }

      this.trackPerformance('databaseCleanup', startTime);
    } catch (error) {
      console.error('Failed to clean up database:', error);
    }
  }

  /**
   * Process a batch of files
   */
  private async processBatch(files: TFile[]): Promise<void> {
    if (files.length === 0) return;

    try {
      const startTime = performance.now();

      // Group files by type for more efficient processing
      const filesByType: Record<string, TFile[]> = {};

      for (const file of files) {
        const fileType = this.detectFileType(file.path);
        if (fileType) {
          if (!filesByType[fileType]) {
            filesByType[fileType] = [];
          }
          filesByType[fileType].push(file);
        }
      }

      // Process each type separately
      for (const [fileType, typeFiles] of Object.entries(filesByType)) {
        await this.processFilesByType(fileType, typeFiles);
      }

      this.trackPerformance('batchTotal', startTime);
    } catch (error) {
      console.error('Failed to process batch:', error);
      throw error;
    }
  }

  /**
   * Process files of a specific type
   */
  private async processFilesByType(fileType: string, files: TFile[]): Promise<void> {
    try {
      const startTime = performance.now();

      // Get file type configuration
      const typeConfig = fileDB.getFileTypeConfig(fileType);

      if (!typeConfig) {
        console.error(`No configuration found for file type: ${fileType}`);
        return;
      }

      // Get paths to check
      const pathsToCheck = files.map(file => file.path);

      // Get existing records by path
      const dbStart = performance.now();
      const existingRecords = await fileDB.getFilesByPaths(pathsToCheck);
      this.trackPerformance('dbLookup', dbStart);

      // Process each file based on type configuration
      const fileRecordsToUpsert: IFileRecord[] = [];

      // Read all files in parallel for efficiency
      const fileReadPromises = files.map(async (file) => {
        const fileReadStart = performance.now();

        // Read content (needed for both content storage and metadata extraction)
        const content = await this.app.vault.read(file);

        this.trackPerformance('fileRead', fileReadStart);

        return { file, content };
      });

      // Wait for all reads to complete
      const fileReadResults = await Promise.all(fileReadPromises);

      // Process results
      for (const { file, content } of fileReadResults) {
        const path = file.path;
        const existing = existingRecords[path];

        // Calculate content hash (used for all file types for change detection)
        const contentHash = this.calculateContentHash(content);

        // Check if content changed using hash comparison (skip if unchanged)
        if (existing && existing.contentHash === contentHash) {
          // No change, skip update
          this.fileStates.set(path, {
            hash: contentHash,
            lastSync: Date.now(),
            syncInProgress: false,
            fileType: fileType
          });
          continue;
        }

        // Extract directory and filename
        const lastSlashIndex = path.lastIndexOf('/');
        const directory = lastSlashIndex >= 0 ? path.substring(0, lastSlashIndex + 1) : '/';
        const filename = lastSlashIndex >= 0 ? path.substring(lastSlashIndex + 1) : path;

        // Create base record
        const fileRecord: IFileRecord = {
          id: existing?.id || fileDB.generateId(),
          path: path,
          fileType: fileType,
          directory: directory,
          filename: filename,
          fileCreationDate: new Date(file.stat.ctime).toISOString(),
          fileModificationDate: new Date(file.stat.mtime).toISOString(),
          insertedDate: existing?.insertedDate || new Date().toISOString(),
          lastUpdatedDate: new Date().toISOString(),
          contentHash: contentHash
        };

        // Add content if needed for this file type
        if (typeConfig.storeContent) {
          const parseStart = performance.now();
          if (typeConfig.parseContent) {
            fileRecord.content = typeConfig.parseContent(content);
          } else {
            fileRecord.content = content;
          }
          this.trackPerformance('contentParsing', parseStart);
        }

        // Extract metadata if configured
        if (typeConfig.extractMetadata) {
          const metadataStart = performance.now();
          const metadata = typeConfig.extractMetadata(content, file);
          Object.assign(fileRecord, metadata);
          this.trackPerformance('metadataExtraction', metadataStart);
        }

        fileRecordsToUpsert.push(fileRecord);

        // Update file state
        this.fileStates.set(path, {
          hash: contentHash,
          lastSync: Date.now(),
          syncInProgress: false,
          fileType: fileType
        });
      }

      // Perform batch update if any changes were detected
      if (fileRecordsToUpsert.length > 0) {
        const dbSaveStart = performance.now();
        await fileDB.batchUpsertFiles(fileRecordsToUpsert);
        this.trackPerformance('dbSave', dbSaveStart);

        console.log(`Type ${fileType}: Processed ${files.length}, updated ${fileRecordsToUpsert.length}`);
      } else {
        console.log(`Type ${fileType}: Processed ${files.length}, no updates needed`);
      }

      this.trackPerformance(`process${fileType}`, startTime);
    } catch (error) {
      console.error(`Failed to process files of type ${fileType}:`, error);
      throw error;
    }
  }

  /**
   * Schedule sync check with debouncing
   */
  private scheduleSyncCheck(): void {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
    }

    if (!this.syncing) {
      this.syncTimer = setTimeout(() => this.performSync(), 200);
    }
  }

  /**
   * Perform sync for all pending files
   */
  private async performSync(): Promise<void> {
    if (this.syncing) return;

    this.syncing = true;
    this.syncTimer = null;

    try {
      // Get all paths that need syncing
      const filesToSync = Array.from(this.pendingSync);
      this.pendingSync.clear();

      if (filesToSync.length === 0) {
        this.syncing = false;
        return;
      }

      console.log(`Starting sync of ${filesToSync.length} files`);

      // Group files into batches for processing
      const fileBatches: TFile[][] = [[]];
      let currentBatch = 0;
      const MAX_BATCH_SIZE = 20;

      // Collect files that actually exist
      for (const path of filesToSync) {
        const file = this.app.vault.getAbstractFileByPath(path);

        if (file instanceof TFile) {
          // Check if current batch is full
          if (fileBatches[currentBatch].length >= MAX_BATCH_SIZE) {
            fileBatches.push([]);
            currentBatch++;
          }

          fileBatches[currentBatch].push(file);
        }
      }

      // Process each batch
      for (const batch of fileBatches) {
        if (batch.length > 0) {
          await this.processBatch(batch);
        }
      }

      console.log(`Completed sync of ${filesToSync.length} files`);
    } catch (error) {
      console.error('Error during sync:', error);
    } finally {
      this.syncing = false;

      // If more files were added during processing, schedule another run
      if (this.pendingSync.size > 0) {
        this.scheduleSyncCheck();
      }
    }
  }

  /**
   * Delete a file from the database
   */
  private async deleteFileFromDatabase(path: string): Promise<void> {
    try {
      console.log(`Deleting file from database: ${path}`);

      // Remove from tracking
      this.fileStates.delete(path);
      this.pendingSync.delete(path);

      // Delete from database
      await fileDB.deleteFileByPath(path);

      console.log(`File deleted: ${path}`);
    } catch (error) {
      console.error(`Failed to delete file: ${path}`, error);
    }
  }

  /**
   * Handle file rename in database
   */
  private async renameFileInDatabase(file: TFile, oldPath: string): Promise<void> {
    try {
      console.log(`Renaming file in database: ${oldPath} -> ${file.path}`);

      // Get the existing record
      const existingFile = await fileDB.getFileByPath(oldPath);

      if (existingFile) {
        const fileType = this.detectFileType(file.path);
        if (!fileType) {
          // If the new path doesn't match any file type pattern, just delete the old record
          await this.deleteFileFromDatabase(oldPath);
          return;
        }

        // Get the type config
        const typeConfig = fileDB.getFileTypeConfig(fileType);
        if (!typeConfig) {
          console.error(`No configuration found for file type: ${fileType}`);
          return;
        }

        // Read current content (needed for hash and possibly content storage)
        const content = await this.app.vault.read(file);
        const contentHash = this.calculateContentHash(content);

        // Extract directory and filename
        const lastSlashIndex = file.path.lastIndexOf('/');
        const directory = lastSlashIndex >= 0 ? file.path.substring(0, lastSlashIndex + 1) : '/';
        const filename = lastSlashIndex >= 0 ? file.path.substring(lastSlashIndex + 1) : file.path;

        // Create updated record, preserving original ID and inserted date
        const updatedFile: IFileRecord = {
          ...existingFile,
          path: file.path,
          fileType: fileType,
          directory: directory,
          filename: filename,
          fileModificationDate: new Date(file.stat.mtime).toISOString(),
          lastUpdatedDate: new Date().toISOString(),
          contentHash: contentHash
        };

        // Handle content based on file type config
        if (typeConfig.storeContent) {
          if (typeConfig.parseContent) {
            updatedFile.content = typeConfig.parseContent(content);
          } else {
            updatedFile.content = content;
          }
        } else if (updatedFile.content !== undefined) {
          // Remove content if this file type doesn't store it
          delete updatedFile.content;
        }

        // Extract metadata if configured
        if (typeConfig.extractMetadata) {
          const metadata = typeConfig.extractMetadata(content, file);
          Object.assign(updatedFile, metadata);
        }

        // Transaction: delete old + add new
        await fileDB.deleteFileByPath(oldPath);
        await fileDB.upsertFile(updatedFile);

        // Update tracking
        this.fileStates.delete(oldPath);
        this.fileStates.set(file.path, {
          hash: contentHash,
          lastSync: Date.now(),
          syncInProgress: false,
          fileType: fileType
        });

        console.log(`File renamed: ${oldPath} -> ${file.path}`);
      } else {
        // File not found in DB, treat as new file
        console.log(`No existing record found for renamed file: ${oldPath}, treating as new file`);
        this.handleFileChange(file);
      }
    } catch (error) {
      console.error(`Failed to rename file: ${oldPath} -> ${file.path}`, error);
    }
  }

  /**
   * Track performance metrics
   */
  private trackPerformance(operation: string, startTime: number): void {
    const duration = performance.now() - startTime;

    if (!this.perfMetrics[operation]) {
      this.perfMetrics[operation] = { count: 0, totalTime: 0 };
    }

    this.perfMetrics[operation].count++;
    this.perfMetrics[operation].totalTime += duration;
  }

  /**
   * Get performance report
   */
  getPerformanceReport(): Record<string, any> {
    const report: Record<string, any> = {
      operations: {}
    };

    let totalTime = 0;

    for (const [operation, metrics] of Object.entries(this.perfMetrics)) {
      report.operations[operation] = {
        count: metrics.count,
        totalTime: metrics.totalTime.toFixed(2) + 'ms',
        averageTime: (metrics.totalTime / metrics.count).toFixed(2) + 'ms'
      };

      totalTime += metrics.totalTime;
    }

    report.totalTime = totalTime.toFixed(2) + 'ms';

    return report;
  }

  /**
   * Clear performance metrics
   */
  clearPerformanceMetrics(): void {
    this.perfMetrics = {};
  }

  /**
   * Reset the sync engine and database
   * @param fileTypes Optional array of file types to reset. If not provided, all file types will be reset.
   */
  async reset(fileTypes?: string[]): Promise<void> {
    console.log(`Resetting sync engine for file types: ${fileTypes ? fileTypes.join(', ') : 'ALL'}`);

    try {
      if (fileTypes && fileTypes.length > 0) {
        // Selective reset for specific file types
        const startTime = performance.now();

        // Get all file records for the specified types
        let filesToDelete: IFileRecord[] = [];
        for (const fileType of fileTypes) {
          const typeFiles = await fileDB.getFilesByType(fileType);
          filesToDelete = filesToDelete.concat(typeFiles);
        }

        if (filesToDelete.length > 0) {
          // Delete records for the specified file types
          const pathsToDelete = filesToDelete.map(file => file.path);
          const deleted = await fileDB.deleteFilesByPaths(pathsToDelete);

          // Clear file states for deleted files
          for (const file of filesToDelete) {
            this.fileStates.delete(file.path);
          }

          console.log(`Selectively deleted ${deleted} records for file types: ${fileTypes.join(', ')}`);
          this.trackPerformance('selectiveReset', startTime);
        }
      } else {
        // Full reset
        // Clear all in-memory state
        this.fileStates.clear();
        this.pendingSync.clear();
        this.syncing = false;
        this.clearPerformanceMetrics();

        if (this.syncTimer) {
          clearTimeout(this.syncTimer);
          this.syncTimer = null;
        }

        // Reset database
        await fileDB.reset();

        console.log('Complete FileSyncEngine reset completed');
      }

      // Show notice to user
      new Notice(`Reset sync database for ${fileTypes ? fileTypes.join(', ') : 'all'} file types`);
    } catch (error) {
      console.error('Error during reset:', error);
      throw error;
    }
  }
}