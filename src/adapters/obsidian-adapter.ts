// src/adapters/obsidian-adapter.ts
import { App, Plugin, TAbstractFile, TFile } from 'obsidian';
import { SyncEngine } from '../core/sync-engine';
import { FileEvent, FileType, Rule, SyncSettings } from '../types';
import { createNodeFileSystem } from '../utils/file-system';
import { Logger } from '../utils/logger';

export function setupObsidianSync(
  plugin: Plugin, 
  app: App, 
  settings: SyncSettings,
  logger: Logger
): SyncEngine {
  logger.info('obsidian-adapter.ts', 'Setting up Obsidian sync');
  
  // Create rules
  const rules: Rule[] = [
    // add rules here
  ];
  
  const fileSystem = createNodeFileSystem(logger);
  const syncEngine = new SyncEngine(fileSystem, settings, rules, logger);
  setupEventListeners(plugin, app, syncEngine, logger);
  
  logger.info('obsidian-adapter.ts', 'Obsidian sync setup complete');
  return syncEngine;
}

function setupEventListeners(
  plugin: Plugin, 
  app: App, 
  syncEngine: SyncEngine,
  logger: Logger
): void {
  logger.debug('obsidian-adapter.ts', 'Setting up event listeners');
  
  // File creation
  plugin.registerEvent(
    app.vault.on('create', async (file: TAbstractFile) => {
      if (file instanceof TFile) {
        logger.debug('obsidian-adapter.ts', `File created: ${file.path}`);
        await handleFileEvent(app, file, 'create', syncEngine, logger);
      }
    })
  );
  
  // File modification
  plugin.registerEvent(
    app.vault.on('modify', async (file: TAbstractFile) => {
      if (file instanceof TFile) {
        logger.debug('obsidian-adapter.ts', `File modified: ${file.path}`);
        await handleFileEvent(app, file, 'modify', syncEngine, logger);
      }
    })
  );
  
  // File deletion
  plugin.registerEvent(
    app.vault.on('delete', async (file: TAbstractFile) => {
      if (file instanceof TFile) {
        logger.debug('obsidian-adapter.ts', `File deleted: ${file.path}`);
        await handleFileEvent(app, file, 'delete', syncEngine, logger);
      }
    })
  );
  
  // File rename
  plugin.registerEvent(
    app.vault.on('rename', async (file: TAbstractFile, oldPath: string) => {
      if (file instanceof TFile) {
        logger.debug('obsidian-adapter.ts', `File renamed: ${oldPath} -> ${file.path}`);
        await handleRenameEvent(app, file, oldPath, syncEngine, logger);
      }
    })
  );
  
  logger.debug('obsidian-adapter.ts', 'Event listeners setup complete');
}

async function handleFileEvent(
  app: App, 
  file: TFile, 
  action: 'create' | 'modify' | 'delete',
  syncEngine: SyncEngine,
  logger: Logger
): Promise<void> {
  // Determine file type
  const fileType = getFileType(file);
  
  if (fileType === 'unknown') {
    logger.error('obsidian-adapter.ts', `Unknown file type: ${file.path}`);
    return;
  }
  
  // Create event object
  const event: FileEvent = {
    name: file.name,
    path: file.path,
    type: fileType,
    action,
    timestamp: Date.now()
  };
  
  // Add content for appropriate file types
  if ((fileType === 'markdown' || fileType === 'meta') && action !== 'delete') {
    try {
      // Use cachedRead for better performance
      event.content = await app.vault.cachedRead(file);
    } catch (error) {
      logger.error('obsidian-adapter.ts', `Error reading file content: ${error}`);
    }
  }
  
  // Queue event for processing
  syncEngine.queueEvent(event);
  
  logger.debug('obsidian-adapter.ts', `Queued ${action} event for ${file.path}`);
}

async function handleRenameEvent(
  app: App,
  file: TFile,
  oldPath: string,
  syncEngine: SyncEngine,
  logger: Logger
): Promise<void> {
  // Determine file type
  const fileType = getFileType(file);
  
  if (fileType === 'unknown') {
    logger.error('obsidian-adapter.ts', `Unknown file type: ${file.path}`);
    return;
  }
  
  // Create event object
  const event: FileEvent = {
    name: file.name,
    path: file.path,
    type: fileType,
    action: 'rename',
    oldPath,
    timestamp: Date.now()
  };
  
  // Add content for appropriate file types
  if (fileType === 'markdown' || fileType === 'meta') {
    try {
      event.content = await app.vault.cachedRead(file);
    } catch (error) {
      logger.error('obsidian-adapter.ts', `Error reading file content: ${error}`);
    }
  }
  
  // Queue event for processing
  syncEngine.queueEvent(event);
  
  logger.debug('obsidian-adapter.ts', `Queued rename event: ${oldPath} -> ${file.path}`);
}

// Export function to determine file type
// TODO: Make this so we can add custom file types
export function getFileType(file: TFile): FileType {
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
}