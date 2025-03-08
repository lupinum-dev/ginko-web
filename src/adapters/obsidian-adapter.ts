// src/adapters/obsidian-adapter.ts
import { App, Plugin, TAbstractFile, TFile } from 'obsidian';
import { createSyncEngine } from '../core/sync-engine';
import { FileEvent, FileType, Logger, Rule, SyncSettings } from '../types';

/**
 * Determines the file type based on the file
 */
export const getFileType = (file: TFile): FileType => {
  if (file.name.endsWith('_meta.md')) {
    return 'meta';
  }
  
  if (file.extension === 'md') {
    return 'markdown';
  }
  
  if (file.path.includes('/_assets/')) {
    return 'asset';
  }
  
  return 'unknown';
};

/**
 * Creates a file event object from an Obsidian file
 */
export const createFileEvent = async (
  app: App,
  file: TFile,
  action: 'create' | 'modify' | 'delete',
  oldPath?: string,
  logger?: Logger
): Promise<FileEvent> => {
  // Determine file type
  const fileType = getFileType(file);
  
  // Create event object
  const event: FileEvent = {
    name: file.name,
    path: file.path,
    type: fileType,
    action: oldPath ? 'rename' : action,
    timestamp: Date.now()
  };
  
  // Add old path for rename events
  if (oldPath) {
    event.oldPath = oldPath;
  }
  
  // Add content for appropriate file types and actions
  if ((fileType === 'markdown' || fileType === 'meta') && action !== 'delete') {
    try {
      // Use cachedRead for better performance
      event.content = await app.vault.cachedRead(file);
    } catch (error) {
      logger?.error('obsidian-adapter', `Error reading file content: ${error}`);
    }
  }
  
  return event;
};

/**
 * Sets up Obsidian event listeners
 */
export const setupEventListeners = (
  plugin: Plugin,
  app: App,
  syncEngine: ReturnType<typeof createSyncEngine>,
  logger?: Logger
): void => {
  logger?.debug('obsidian-adapter', 'Setting up event listeners');
  
  // File creation
  plugin.registerEvent(
    app.vault.on('create', async (file: TAbstractFile) => {
      if (!(file instanceof TFile)) return;
      
      logger?.debug('obsidian-adapter', `File created: ${file.path}`);
      const event = await createFileEvent(app, file, 'create', undefined, logger);
      ;
      
      if (event.type !== 'unknown') {
        syncEngine.queueEvent(event);
      }
    })
  );
  
  // File modification
  plugin.registerEvent(
    app.vault.on('modify', async (file: TAbstractFile) => {
      if (!(file instanceof TFile)) return;
      
      logger?.debug('obsidian-adapter', `File modified: ${file.path}`);
      const event = await createFileEvent(app, file, 'modify', undefined, logger);
      
      if (event.type !== 'unknown') {
        syncEngine.queueEvent(event);
      }
    })
  );
  
  // File deletion
  plugin.registerEvent(
    app.vault.on('delete', async (file: TAbstractFile) => {
      if (!(file instanceof TFile)) return;
      
      logger?.debug('obsidian-adapter', `File deleted: ${file.path}`);
      const event = await createFileEvent(app, file, 'delete', undefined, logger);
      
      if (event.type !== 'unknown') {
        syncEngine.queueEvent(event);
      }
    })
  );
  
  // File rename
  plugin.registerEvent(
    app.vault.on('rename', async (file: TAbstractFile, oldPath: string) => {
      if (!(file instanceof TFile)) return;
      
      logger?.debug('obsidian-adapter', `File renamed: ${oldPath} -> ${file.path}`);
      const event = await createFileEvent(app, file, 'modify', oldPath, logger);
      
      if (event.type !== 'unknown') {
        syncEngine.queueEvent(event);
      }
    })
  );
  
  logger?.debug('obsidian-adapter', 'Event listeners setup complete');
};

/**
 * Creates rules for the sync engine
 */
export const createSyncRules = (settings: SyncSettings): Rule[] => {
  // This is a placeholder implementation
  return [
    {
      name: 'Placeholder Rule',
      shouldApply: () => false,
      transform: (path) => path
    }
  ];
};

/**
 * Sets up Obsidian sync
 */
export const setupObsidianSync = (
  plugin: Plugin,
  app: App,
  settings: SyncSettings,
  logger?: Logger
) => {
  logger?.info('obsidian-adapter', 'Setting up Obsidian sync');
  
  // Create rules
  const rules = createSyncRules(settings);
  
  // Create sync engine
  const syncEngine = createSyncEngine(settings, rules, logger);
  
  // Set up event listeners
  setupEventListeners(plugin, app, syncEngine, logger);
  
  logger?.info('obsidian-adapter', 'Obsidian sync setup complete');
  return syncEngine;
};