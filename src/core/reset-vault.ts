// src/core/reset-vault.ts
import { App } from 'obsidian';
import { createSyncEngine } from './sync-engine';
import { Logger, SyncSettings } from '../types';
import * as path from 'path';
import { createFileSystem } from '../utils/file-system';

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
    
    // Create metadata file
    const metaData = {
      resetTimestamp: Date.now(),
      version: '1.0.0'
    };
    
    await fs.writeFile(metaFilePath, JSON.stringify(metaData, null, 2));
    logger?.info('reset-vault', `Created metadata file: ${metaFilePath}`);
    
    logger?.info('reset-vault', 'Vault reset completed successfully');
  } catch (error) {
    logger?.error('reset-vault', `Failed to reset vault: ${error}`);
    throw error;
  }
};