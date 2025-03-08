// src/adapters/obsidian-adapter.ts
import { App, Plugin, TAbstractFile, TFile } from 'obsidian';
import { SyncEngine } from '../core/sync-engine';
import { FileEvent, FileType, Rule, SyncSettings } from '../types';
import { nodeFileSystem } from './file-system-adapter';
import { 
  createAssetRule, 
  createBasePathRule, 
  createContentPathRule, 
  createLanguageRule, 
  createMetaSlugRule 
} from '../rules/generic-rules';

export function setupObsidianSync(plugin: Plugin, app: App, settings: SyncSettings): SyncEngine {
  // Create rules
  const rules: Rule[] = [
    createBasePathRule(),
    createContentPathRule(),
    createLanguageRule(),
    createMetaSlugRule(),
    createAssetRule()
  ];

  app.vault.cachedRead
  
  // Create sync engine
  const syncEngine = new SyncEngine(nodeFileSystem, settings, rules);
  
  // Set up event listeners
  setupEventListeners(plugin, app, syncEngine);
  
  return syncEngine;
}

function setupEventListeners(plugin: Plugin, app: App, syncEngine: SyncEngine): void {
  // File creation
  plugin.registerEvent(
    app.vault.on('create', async (file: TAbstractFile) => {
      if (file instanceof TFile) {
        await handleFileEvent(app, file, 'create', syncEngine);
      }
    })
  );
  
  // File modification
  plugin.registerEvent(
    app.vault.on('modify', async (file: TAbstractFile) => {
      if (file instanceof TFile) {
        await handleFileEvent(app, file, 'modify', syncEngine);
      }
    })
  );
  
  // File deletion
  plugin.registerEvent(
    app.vault.on('delete', async (file: TAbstractFile) => {
      if (file instanceof TFile) {
        await handleFileEvent(app, file, 'delete', syncEngine);
      }
    })
  );
  
  // File rename
  plugin.registerEvent(
    app.vault.on('rename', async (file: TAbstractFile, oldPath: string) => {
      if (file instanceof TFile) {
        await handleRenameEvent(app, file, oldPath, syncEngine);
      }
    })
  );
}

async function handleFileEvent(
  app: App, 
  file: TFile, 
  action: 'create' | 'modify' | 'delete',
  syncEngine: SyncEngine
): Promise<void> {
  // Determine file type
  const fileType = getFileType(file);
  
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
      event.content = await app.vault.read(file);
    } catch (error) {
      console.error(`Error reading file content: ${error}`);
    }
  }
  
  // Queue event for processing
  syncEngine.queueEvent(event);
}

async function handleRenameEvent(
  app: App,
  file: TFile,
  oldPath: string,
  syncEngine: SyncEngine
): Promise<void> {
  // Determine file type
  const fileType = getFileType(file);
  
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
      event.content = await app.vault.read(file);
    } catch (error) {
      console.error(`Error reading file content: ${error}`);
    }
  }
  
  // Queue event for processing
  syncEngine.queueEvent(event);
}

function getFileType(file: TFile): FileType {
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