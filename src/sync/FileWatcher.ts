import { App, TAbstractFile, TFile, Plugin } from 'obsidian';
import { FileSyncEngine } from './FileSyncEngine';
import { fileDB } from './FileDatabase';

/**
 * FileWatcher sets up file event handlers and connects them to the sync engine
 * This class integrates with the Obsidian plugin system and manages the lifecycle
 * of file synchronization
 */
export class FileWatcher {
  private app: App;
  private plugin: Plugin;
  private syncEngine: FileSyncEngine;
  private isInitialized = false;
  private isInitializing = false;
  private failedInitAttempts = 0;
  private maxInitAttempts = 3;
  private initRetryDelay = 5000; // 5 seconds

  constructor(plugin: Plugin, app: App) {
    this.app = app;
    this.plugin = plugin;
    this.syncEngine = new FileSyncEngine(app);
  }

  /**
   * Initialize the file watcher and sync engine
   */
  async initialize(): Promise<void> {
    if (this.isInitialized || this.isInitializing) return;

    this.isInitializing = true;

    try {
      console.log('Initializing FileWatcher');

      // Initialize the sync engine
      await this.syncEngine.initialize();

      // Wait for layout to be ready
      this.app.workspace.onLayoutReady(this.onLayoutReady.bind(this));

      this.isInitialized = true;
      this.isInitializing = false;
      this.failedInitAttempts = 0;

      console.log('FileWatcher initialized successfully');
    } catch (error) {
      this.isInitializing = false;
      this.failedInitAttempts++;

      console.error(`FileWatcher initialization failed (attempt ${this.failedInitAttempts}):`, error);

      // Retry initialization if not exceeding max attempts
      if (this.failedInitAttempts < this.maxInitAttempts) {
        console.log(`Retrying initialization in ${this.initRetryDelay / 1000} seconds...`);

        setTimeout(() => {
          this.initialize();
        }, this.initRetryDelay);
      } else {
        console.error('Maximum initialization attempts reached. Giving up.');
      }
    }
  }

  /**
   * Setup event handlers when layout is ready
   */
  private onLayoutReady(): void {
    try {
      console.log('Setting up file event handlers');

      // Register event for file modifications
      this.plugin.registerEvent(
        this.app.vault.on('modify', (file: TAbstractFile) => {
          if (file instanceof TFile) {
            const fileType = this.syncEngine.detectFileType(file.path);
            if (fileType) {
              console.log(`File modified: ${file.path} (${fileType})`);
              this.syncEngine.handleFileChange(file);
            }
          }
        })
      );

      // Register event for file renames
      this.plugin.registerEvent(
        this.app.vault.on('rename', (file: TAbstractFile, oldPath: string) => {
          if (file instanceof TFile) {
            const newFileType = this.syncEngine.detectFileType(file.path);
            const oldFileType = this.syncEngine.detectFileType(oldPath);

            if (newFileType || oldFileType) {
              console.log(`File renamed: ${oldPath} -> ${file.path}`);
              this.syncEngine.handleFileRename(file, oldPath);
            }
          }
        })
      );

      // Register event for file creations
      this.plugin.registerEvent(
        this.app.vault.on('create', (file: TAbstractFile) => {
          if (file instanceof TFile) {
            const fileType = this.syncEngine.detectFileType(file.path);
            if (fileType) {
              console.log(`File created: ${file.path} (${fileType})`);
              this.syncEngine.handleFileChange(file);
            }
          }
        })
      );

      // Register event for file deletions
      this.plugin.registerEvent(
        this.app.vault.on('delete', (file: TAbstractFile) => {
          if (file instanceof TFile) {
            const fileType = this.syncEngine.detectFileType(file.path);
            if (fileType) {
              console.log(`File deleted: ${file.path} (${fileType})`);
              this.syncEngine.handleFileDelete(file.path);
            }
          }
        })
      );

      // Start initial loading of all files
      this.loadAllFiles();

      console.log('File event handlers set up successfully');
    } catch (error) {
      console.error('Failed to set up file event handlers:', error);
    }
  }

  /**
   * Load all existing files
   */
  async loadAllFiles(): Promise<void> {
    try {
      // Small delay to ensure all plugins are loaded
      setTimeout(async () => {
        await this.syncEngine.loadAllFiles();
      }, 1000);
    } catch (error) {
      console.error('Failed to load all files:', error);
    }
  }

  /**
   * Manually trigger a full resync of all files
   */
  async forceResync(): Promise<void> {
    if (!this.isInitialized) {
      console.warn('Cannot force resync: FileWatcher not initialized');
      return;
    }

    try {
      console.log('Forcing full resync of all files');
      await this.syncEngine.loadAllFiles();
      console.log('Full resync completed');
    } catch (error) {
      console.error('Failed to force resync:', error);
    }
  }

  /**
   * Reset the watcher, sync engine, and database
   * This completely clears all data and rebuilds from scratch
   * @param fileTypes Optional array of file types to reset. If not provided, all file types will be reset.
   */
  async forceReset(fileTypes?: string[]): Promise<void> {
    if (!this.isInitialized) {
      console.warn('Cannot force reset: FileWatcher not initialized');
      return;
    }

    try {
      if (fileTypes && fileTypes.length > 0) {
        console.log(`Forcing reset of sync engine and database for file types: ${fileTypes.join(', ')}`);
      } else {
        console.log('Forcing complete reset of sync engine and database');
      }

      // Reset the sync engine for specified file types or all if not specified
      await this.syncEngine.reset(fileTypes);

      // Reload the specified file types or all files
      await this.syncEngine.loadAllFiles(fileTypes);

      console.log('Force reset completed');
    } catch (error) {
      console.error('Failed to force reset:', error);
    }
  }

  /**
   * Reset and reload specific file types
   * @param fileTypes Array of file types to reset and reload
   */
  async resetFileTypes(fileTypes: string[]): Promise<void> {
    await this.forceReset(fileTypes);
  }

  /**
   * Get performance metrics
   */
  getPerformanceReport(): Record<string, any> {
    if (!this.isInitialized) {
      return { error: 'FileWatcher not initialized' };
    }

    return this.syncEngine.getPerformanceReport();
  }
}

/**
 * Setup function to create and initialize the FileWatcher
 */
export function setupFileWatcher(plugin: Plugin, app: App): FileWatcher {
  const watcher = new FileWatcher(plugin, app);
  watcher.initialize();
  return watcher;
}