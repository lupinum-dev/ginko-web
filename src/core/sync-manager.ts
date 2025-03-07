// src/core/sync-manager.ts
import { SyncEvent, SyncSettings, DEFAULT_SETTINGS, FileSystem } from '../types';
import * as path from 'path';
import * as fs from 'fs/promises';

export class SyncManager {
  private eventQueue: SyncEvent[] = [];
  private processing = false;
  private timeoutId: NodeJS.Timeout | null = null;
  private fs: FileSystem;
  private settings: SyncSettings;

  constructor(
    settings: Partial<SyncSettings> = {}, 
    fileSystem: FileSystem = {
      mkdir: fs.mkdir,
      writeFile: fs.writeFile,
      readFile: fs.readFile,
      rm: fs.rm,
      access: async (path) => {
        try {
          await fs.access(path);
          return true;
        } catch {
          return false;
        }
      }
    }
  ) {
    this.settings = { ...DEFAULT_SETTINGS, ...settings };
    this.fs = fileSystem;
  }

  // Add an event to the queue
  async queueEvent(event: SyncEvent): Promise<void> {
    if (this.shouldSkipFile(event.path)) {
      this.log(`Skipping excluded file: ${event.path}`);
      return;
    }

    this.log(`Queueing ${event.action} event for ${event.path}`);
    this.eventQueue.push(event);

    // Clear existing timeout if there is one
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    // Set a new timeout to process the queue
    this.timeoutId = setTimeout(() => this.processQueue(), 100);
  }

  // Process all events in the queue
  private async processQueue(): Promise<void> {
    if (this.processing || this.eventQueue.length === 0) {
      return;
    }

    this.processing = true;
    this.log(`Processing ${this.eventQueue.length} events`);
    
    try {
      // Sort queue by timestamp to handle events in order
      this.eventQueue.sort((a, b) => a.timestamp - b.timestamp);
      
      // Process each event
      while (this.eventQueue.length > 0) {
        const event = this.eventQueue.shift();
        if (event) {
          await this.processEvent(event);
        }
      }
    } catch (error) {
      this.log(`Error processing queue: ${error}`, 'error');
    } finally {
      this.processing = false;
      this.timeoutId = null;
    }
  }

  // Process a single event
  private async processEvent(event: SyncEvent): Promise<void> {
    try {
      switch (event.action) {
        case 'create':
        case 'modify':
          await this.createOrUpdateFile(event);
          break;
        case 'delete':
          await this.deleteFile(event);
          break;
        case 'rename':
          await this.renameFile(event);
          break;
      }
    } catch (error) {
      this.log(`Error processing event ${event.action} for ${event.path}: ${error}`, 'error');
    }
  }

  // Create or update a file in the target location
  private async createOrUpdateFile(event: SyncEvent): Promise<void> {
    const targetPath = this.getTargetPath(event.path);
    
    // Create directory structure if needed
    await this.createDirectory(path.dirname(targetPath));
    
    // Write the file content
    const content = event.content || '';
    await this.fs.writeFile(targetPath, content, 'utf8');
    
    this.log(`${event.action === 'create' ? 'Created' : 'Updated'} file: ${targetPath}`);
  }

  // Delete a file from the target location
  private async deleteFile(event: SyncEvent): Promise<void> {
    const targetPath = this.getTargetPath(event.path);
    
    // Check if the file exists
    const exists = await this.fs.access(targetPath);
    if (exists) {
      await this.fs.rm(targetPath, { force: true });
      this.log(`Deleted file: ${targetPath}`);
    } else {
      this.log(`File does not exist, skipping delete: ${targetPath}`);
    }
  }

  // Rename a file in the target location
  private async renameFile(event: SyncEvent): Promise<void> {
    if (!event.oldPath) {
      this.log(`Missing oldPath for rename event: ${event.path}`, 'error');
      return;
    }
    
    const oldTargetPath = this.getTargetPath(event.oldPath);
    const newTargetPath = this.getTargetPath(event.path);
    
    // Check if the old file exists
    const exists = await this.fs.access(oldTargetPath);
    if (!exists) {
      // If old file doesn't exist, just create the new one
      await this.createOrUpdateFile(event);
      return;
    }
    
    // Create directory structure for new path
    await this.createDirectory(path.dirname(newTargetPath));
    
    // Read old file content
    const content = await this.fs.readFile(oldTargetPath, 'utf8');
    
    // Write to new location
    await this.fs.writeFile(newTargetPath, content, 'utf8');
    
    // Delete old file
    await this.fs.rm(oldTargetPath, { force: true });
    
    this.log(`Renamed file: ${oldTargetPath} → ${newTargetPath}`);
  }

  // Get the target path for a file
  private getTargetPath(sourcePath: string): string {
    return path.join(this.settings.targetBasePath, sourcePath);
  }

  // Create a directory, including parent directories
  private async createDirectory(dirPath: string): Promise<void> {
    try {
      await this.fs.mkdir(dirPath, { recursive: true });
    } catch (error: any) {
      // Ignore if directory already exists
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  // Check if a file should be skipped (in excluded paths)
  private shouldSkipFile(filePath: string): boolean {
    return this.settings.excludePaths.some(excludePath => 
      filePath.startsWith(excludePath)
    );
  }

  // Logging helper
  private log(message: string, level: 'info' | 'error' = 'info'): void {
    if (this.settings.debugMode || level === 'error') {
      const prefix = level === 'error' ? '[ERROR]' : '[INFO]';
      console.log(`${prefix} SyncManager: ${message}`);
    }
  }
}