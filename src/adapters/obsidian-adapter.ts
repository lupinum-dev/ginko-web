// src/adapters/obsidian-adapter.ts
import { App, Plugin, TAbstractFile, TFile } from 'obsidian';
import { SyncManager } from '../core/sync-manager';
import { SyncEvent, FileType, SyncSettings } from '../types';

export class ObsidianAdapter {
  private app: App;
  private plugin: Plugin;
  private syncManager: SyncManager;
  
  constructor(plugin: Plugin, app: App, settings: Partial<SyncSettings> = {}) {
    this.plugin = plugin;
    this.app = app;
    this.syncManager = new SyncManager(settings);
    console.log('Sync manager initialized');
    
    // Automatically set up file watchers in constructor
    this.registerEventListeners();
  }
  
  // Register all event listeners for file changes
  private registerEventListeners(): void {
    console.log('Setting up file watchers');
    
    // File modified
    this.plugin.registerEvent(
      this.app.vault.on('modify', async (file: TAbstractFile) => {
        console.log('File modified', file.name);
        if (file instanceof TFile) {
          await this.handleFileEvent(file, 'modify');
        }
      })
    );
    
    // File created
    this.plugin.registerEvent(
      this.app.vault.on('create', async (file: TAbstractFile) => {
        console.log('File created', file.name);
        if (file instanceof TFile) {
          await this.handleFileEvent(file, 'create');
        }
      })
    );
    
    // File deleted
    this.plugin.registerEvent(
      this.app.vault.on('delete', async (file: TAbstractFile) => {
        console.log('File deleted', file.name);
        if (file instanceof TFile) {
          await this.handleFileEvent(file, 'delete');
        }
      })
    );
    
    // File renamed
    this.plugin.registerEvent(
      this.app.vault.on('rename', async (file: TAbstractFile, oldPath: string) => {
        console.log('File renamed', file.name, oldPath);
        if (file instanceof TFile) {
          await this.handleRenameEvent(file, oldPath);
        }
      })
    );
  }
  
  private async handleFileEvent(
    file: TFile, 
    action: 'create' | 'modify' | 'delete'
  ): Promise<void> {
    // Determine file type
    const fileType = this.getFileType(file);
    
    // Create sync event
    const event: SyncEvent = {
      name: file.name,
      path: file.path,
      type: fileType,
      action,
      timestamp: Date.now()
    };
    
    // Add content for markdown and meta files
    if ((fileType === 'markdown' || fileType === 'meta') && action !== 'delete') {
      try {
        event.content = await this.app.vault.cachedRead(file);
      } catch (error) {
        console.error(`Error reading file content: ${error}`);
      }
    }
    
    // Queue the event for processing
    await this.syncManager.queueEvent(event);
  }
  
  private async handleRenameEvent(file: TFile, oldPath: string): Promise<void> {
    // Determine file type
    const fileType = this.getFileType(file);
    
    // Create sync event
    const event: SyncEvent = {
      name: file.name,
      path: file.path,
      type: fileType,
      action: 'rename',
      oldPath,
      timestamp: Date.now()
    };
    
    // Add content for markdown and meta files
    if (fileType === 'markdown' || fileType === 'meta') {
      try {
        event.content = await this.app.vault.cachedRead(file);
      } catch (error) {
        console.error(`Error reading file content: ${error}`);
      }
    }
    
    // Queue the event for processing
    await this.syncManager.queueEvent(event);
  }
  
  private getFileType(file: TFile): FileType {
    if (file.name.endsWith('_meta.md')) {
      return 'meta';
    }
    
    if (file.extension === 'md') {
      return 'markdown';
    }
    
    if (file.path.includes('_assets/')) {
      return 'asset';
    }
    
    return 'unknown';
  }
  
  // Method to register a custom rule
  registerRule(rule: any): void {
    this.syncManager.registerRule(rule);
  }
  
  // Update settings
  updateSettings(settings: Partial<SyncSettings>): void {
    this.syncManager.updateSettings(settings);
  }
}