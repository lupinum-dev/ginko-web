import Dexie from 'dexie';
import { nanoid } from 'nanoid';
import { Notice } from 'obsidian';

/**
 * Interface for file records stored in the database
 */
export interface IFileRecord {
  id: string;               // Unique identifier for the record
  path: string;             // Full file path in the vault
  fileType: string;         // Type of file (e.g., 'meta', 'markdown', 'gallery', etc.)
  directory: string;        // Directory path without filename
  filename: string;         // Filename only
  fileCreationDate: string; // ISO string of file creation date
  fileModificationDate: string; // ISO string of file modification date
  insertedDate: string;     // ISO string of when file was first added to DB
  lastUpdatedDate: string;  // ISO string of when record was last updated
  content?: any;            // Optional parsed content (only for meta files)
  contentHash?: string;     // Optional hash of the content for verification
  title?: string;           // Optional title extracted from content
  size?: number;            // Optional file size in bytes
}

/**
 * Configuration for how to handle different file types
 */
export interface FileTypeConfig {
  // Determines if full content should be stored
  storeContent: boolean;
  // Function to parse content (if storeContent is true)
  parseContent?: (content: string) => any;
  // Function to extract metadata (applies to all file types)
  extractMetadata?: (content: string, file: any) => Partial<IFileRecord>;
}

/**
 * FileDatabase - Database for tracking files in Obsidian vault
 * Uses Dexie.js to provide IndexedDB access with a clean API
 */
export class FileDatabase extends Dexie {
  // Define tables with their primary keys and indexes
  files!: Dexie.Table<IFileRecord, string>;
  syncState!: Dexie.Table<{ key: string, value: string }, string>;

  // File type configurations
  private fileTypeConfigs: Record<string, FileTypeConfig> = {};

  // Filter function for determining what files to process
  private fileProcessingFilters: Record<string, (path: string) => boolean> = {};

  constructor() {
    super('FileSyncDB');

    // Define database schema
    this.version(1).stores({
      files: 'id, path, fileType, directory, filename, lastUpdatedDate',
      syncState: 'key'
    });

    // Debug logging only in development
    if (process.env.NODE_ENV === 'development') {
      this.on('ready', () => console.log('FileDatabase is ready'));
    }

    // Set up default file type configurations
    this.registerFileType('meta', {
      storeContent: true,
      parseContent: (content: string) => {
        try {
          return JSON.parse(content);
        } catch (error) {
          console.warn('Meta file content is not valid JSON, storing as raw text');
          return content;
        }
      }
    });

    this.registerFileType('markdown', {
      storeContent: false,
      extractMetadata: (content: string, file: any) => {
        // Extract title from first heading or first line
        let title = file.basename;

        // Get first line and check if it's a heading
        const firstLine = content.split('\n')[0] || '';
        if (firstLine.startsWith('# ')) {
          title = firstLine.substring(2).trim();
        }

        return {
          title,
          size: content.length
        };
      }
    });

    // Set up asset file type configuration
    this.registerFileType('asset', {
      storeContent: false,
      extractMetadata: (content: string, file: any) => {
        return {
          size: content.length,
          // Store mime type if available
          mimeType: file.extension ? this.getMimeTypeFromExtension(file.extension) : undefined
        };
      }
    });

    // Set up default processing filters
    this.registerProcessingFilter('meta', (path: string) => path.endsWith('_meta.md'));
    this.registerProcessingFilter('markdown', (path: string) => path.endsWith('.md') && !path.endsWith('_meta.md'));
    this.registerProcessingFilter('asset', (path: string) => {
      const assetExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.pdf', '.mp3', '.mp4', '.wav', '.ogg'];
      const ext = path.substring(path.lastIndexOf('.')).toLowerCase();
      return assetExtensions.includes(ext) || path.includes('_assets/');
    });
  }

  /**
   * Get mime type from file extension
   */
  private getMimeTypeFromExtension(extension: string): string {
    const mimeTypes: Record<string, string> = {
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
      'pdf': 'application/pdf',
      'mp3': 'audio/mpeg',
      'mp4': 'video/mp4',
      'wav': 'audio/wav',
      'ogg': 'audio/ogg'
    };

    const ext = extension.toLowerCase().replace('.', '');
    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Register a file type configuration
   */
  registerFileType(fileType: string, config: FileTypeConfig): void {
    this.fileTypeConfigs[fileType] = config;
    console.log(`Registered file type: ${fileType}`);
  }

  /**
   * Get the configuration for a file type
   */
  getFileTypeConfig(fileType: string): FileTypeConfig | undefined {
    return this.fileTypeConfigs[fileType];
  }

  /**
   * Register a processing filter for a file type
   */
  registerProcessingFilter(fileType: string, filterFn: (path: string) => boolean): void {
    this.fileProcessingFilters[fileType] = filterFn;
    console.log(`Registered processing filter for file type: ${fileType}`);
  }

  /**
   * Get the processing filter for a file type
   */
  getProcessingFilter(fileType: string): ((path: string) => boolean) | undefined {
    return this.fileProcessingFilters[fileType];
  }

  /**
   * Determine file type based on path using registered filters
   */
  determineFileType(path: string): string | null {
    for (const [fileType, filterFn] of Object.entries(this.fileProcessingFilters)) {
      if (filterFn(path)) {
        return fileType;
      }
    }
    return null;
  }

  /**
   * Get all registered file types
   */
  getRegisteredFileTypes(): string[] {
    return Object.keys(this.fileTypeConfigs);
  }

  /**
   * Initialize the database
   */
  async init(): Promise<void> {
    try {
      await this.open();

      // Initialize default sync state if needed
      const stateCount = await this.syncState.count();
      if (stateCount === 0) {
        await this.syncState.bulkPut([
          { key: 'lastFullSync', value: '0' },
          { key: 'syncInProgress', value: 'false' }
        ]);
      }

      console.log('FileDatabase initialized successfully');
    } catch (error) {
      console.error('Failed to initialize FileDatabase:', error);
      new Notice('File database initialization failed');
      throw error;
    }
  }

  /**
   * Upsert a file record (create or update)
   */
  async upsertFile(file: IFileRecord): Promise<string> {
    try {
      await this.files.put(file);
      return file.id;
    } catch (error) {
      console.error('Failed to save file record:', error);
      throw error;
    }
  }

  /**
   * Batch upsert multiple file records
   */
  async batchUpsertFiles(files: IFileRecord[]): Promise<void> {
    if (files.length === 0) return;

    try {
      // Use transaction for better performance and atomicity
      await this.transaction('rw', this.files, async () => {
        await this.files.bulkPut(files);
      });
    } catch (error) {
      console.error(`Failed to batch save ${files.length} file records:`, error);
      throw error;
    }
  }

  /**
   * Get a file record by path
   */
  async getFileByPath(path: string): Promise<IFileRecord | undefined> {
    try {
      return await this.files.where('path').equals(path).first();
    } catch (error) {
      console.error(`Failed to get file record by path: ${path}`, error);
      throw error;
    }
  }

  /**
   * Get a file record by ID
   */
  async getFileById(id: string): Promise<IFileRecord | undefined> {
    try {
      return await this.files.get(id);
    } catch (error) {
      console.error(`Failed to get file record by ID: ${id}`, error);
      throw error;
    }
  }

  /**
   * Check if a file exists by path
   */
  async fileExists(path: string): Promise<boolean> {
    try {
      const count = await this.files.where('path').equals(path).count();
      return count > 0;
    } catch (error) {
      console.error(`Failed to check if file exists: ${path}`, error);
      throw error;
    }
  }

  /**
   * Delete a file record by path
   */
  async deleteFileByPath(path: string): Promise<void> {
    try {
      await this.files.where('path').equals(path).delete();
    } catch (error) {
      console.error(`Failed to delete file record: ${path}`, error);
      throw error;
    }
  }

  /**
   * Delete a file record by ID
   */
  async deleteFileById(id: string): Promise<void> {
    try {
      await this.files.delete(id);
    } catch (error) {
      console.error(`Failed to delete file record by ID: ${id}`, error);
      throw error;
    }
  }

  /**
   * Get all file records
   */
  async getAllFiles(): Promise<IFileRecord[]> {
    try {
      return await this.files.toArray();
    } catch (error) {
      console.error('Failed to get all file records:', error);
      throw error;
    }
  }

  /**
   * Get all file records of a specific type
   */
  async getFilesByType(fileType: string): Promise<IFileRecord[]> {
    try {
      return await this.files.where('fileType').equals(fileType).toArray();
    } catch (error) {
      console.error(`Failed to get files of type: ${fileType}`, error);
      throw error;
    }
  }

  /**
   * Get all file paths in the database
   */
  async getAllFilePaths(): Promise<string[]> {
    try {
      return await this.files.toCollection().primaryKeys();
    } catch (error) {
      console.error('Failed to get all file paths:', error);
      throw error;
    }
  }

  /**
   * Get file records by multiple paths
   */
  async getFilesByPaths(paths: string[]): Promise<Record<string, IFileRecord>> {
    if (paths.length === 0) return {};

    try {
      const result: Record<string, IFileRecord> = {};

      // Use a transaction for better performance
      await this.transaction('r', this.files, async () => {
        // Get all files that match the paths (in chunks to avoid limitations)
        const chunkSize = 100;
        for (let i = 0; i < paths.length; i += chunkSize) {
          const pathsChunk = paths.slice(i, i + chunkSize);
          const files = await this.files.where('path').anyOf(pathsChunk).toArray();

          // Populate the result object
          for (const file of files) {
            result[file.path] = file;
          }
        }
      });

      return result;
    } catch (error) {
      console.error('Failed to get files by paths:', error);
      throw error;
    }
  }

  /**
   * Delete multiple file records by paths
   */
  async deleteFilesByPaths(paths: string[]): Promise<number> {
    if (paths.length === 0) return 0;

    try {
      let totalDeleted = 0;

      // Delete in chunks to avoid limitations
      const chunkSize = 100;
      for (let i = 0; i < paths.length; i += chunkSize) {
        const pathsChunk = paths.slice(i, i + chunkSize);

        // Use transaction for atomicity
        const deleted = await this.transaction('rw', this.files, async () => {
          return await this.files.where('path').anyOf(pathsChunk).delete();
        });

        totalDeleted += deleted;
      }

      return totalDeleted;
    } catch (error) {
      console.error('Failed to delete files by paths:', error);
      throw error;
    }
  }

  /**
   * Get sync state value
   */
  async getSyncState(key: string): Promise<string> {
    try {
      const state = await this.syncState.get(key);
      return state?.value || '';
    } catch (error) {
      console.error(`Failed to get sync state: ${key}`, error);
      throw error;
    }
  }

  /**
   * Update sync state
   */
  async updateSyncState(key: string, value: string): Promise<void> {
    try {
      await this.syncState.put({ key, value });
    } catch (error) {
      console.error(`Failed to update sync state: ${key}`, error);
      throw error;
    }
  }

  /**
   * Reset the database (clear all data)
   */
  async reset(): Promise<void> {
    try {
      await this.transaction('rw', [this.files, this.syncState], async () => {
        await this.files.clear();
        await this.syncState.clear();

        // Reinitialize default sync state
        await this.syncState.bulkPut([
          { key: 'lastFullSync', value: '0' },
          { key: 'syncInProgress', value: 'false' }
        ]);
      });

      console.log('FileDatabase reset successfully');
    } catch (error) {
      console.error('Failed to reset database:', error);
      throw error;
    }
  }

  /**
   * Generate a new ID for a file record
   */
  generateId(): string {
    return nanoid();
  }
}

// Create and export a singleton instance
export const fileDB = new FileDatabase();