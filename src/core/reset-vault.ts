// src/core/reset-vault.ts
import { App, TFile } from 'obsidian';
import { createSyncEngine } from './sync-engine';
import { Logger, SyncSettings } from '../types';
import * as path from 'path';
import { createFileSystem } from '../utils/file-system';
import { createFileEvent, getFileType } from '../adapters/obsidian-adapter';
import { shouldExclude } from './sync-engine';

/**
 * Resets the vault sync state
 */
export const resetVault = async (
  app: App,
  syncEngine: ReturnType<typeof createSyncEngine>,
  settings: SyncSettings,
  logger?: Logger
): Promise<void> => {
  try {
    logger?.info('reset-vault', 'Starting vault reset process');
    
    // Get file system
    const fs = createFileSystem(logger);
    
    // Define paths
    const contentDirPath = path.join(settings.targetBasePath, settings.contentPath);
    const assetsDirPath = path.join(settings.targetBasePath, settings.assetsPath);
    const metaFilePath = path.join(settings.targetBasePath, '.sync-meta.json');
    
    // Create fresh content directory
    logger?.info('reset-vault', `Ensuring content directory exists: ${contentDirPath}`);
    await fs.createDirectory(contentDirPath);
    
    // Create fresh assets directory
    logger?.info('reset-vault', `Ensuring assets directory exists: ${assetsDirPath}`);
    await fs.createDirectory(assetsDirPath);
    

    
    // Get all files from the vault
    logger?.info('reset-vault', 'Creating creation events for all files in the vault');
    const allFiles = app.vault.getFiles();
    let processedCount = 0;
    
    // Process each file
    for (const file of allFiles) {
      // Skip files that should be excluded based on settings
      if (shouldExclude(file.path, settings, logger)) {
        logger?.debug('reset-vault', `Skipping excluded file: ${file.path}`);
        continue;
      }
      
      // Create a creation event for the file
      const event = await createFileEvent(app, file, 'create', undefined, logger);
      
      // Queue the event for processing
      syncEngine.queueEvent(event);
      processedCount++;
    }
    
    logger?.info('reset-vault', `Queued ${processedCount} files for processing`);
    logger?.info('reset-vault', 'Vault reset completed successfully');
  } catch (error) {
    logger?.error('reset-vault', `Failed to reset vault: ${error}`);
    throw error;
  }
};