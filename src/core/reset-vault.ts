// src/core/reset-vault.ts
import { App, TFile } from 'obsidian';
import { SyncEngine } from './sync-engine';
import { FileEvent, SyncSettings } from '../types';
import { Logger } from '../utils/logger';
import * as path from 'path';
import * as fs from 'fs/promises';

/**
 * Reset the target folder and resync the entire vault
 */
export async function resetVault(
  app: App,
  syncEngine: SyncEngine,
  settings: SyncSettings,
  logger: Logger
): Promise<void> {
  logger.info('reset-vault.ts', 'Starting vault reset');
  

  await deleteTargetDirectories(settings, logger);
  await queueAllFiles(app, syncEngine, logger);
  
  logger.info('reset-vault.ts', 'Vault reset completed');
}

/**
 * Delete the content and assets directories in the target
 */
async function deleteTargetDirectories(
  settings: SyncSettings,
  logger: Logger
): Promise<void> {
  // Make sure the target base path exists
  const targetBasePath = path.resolve(settings.targetBasePath);
  try {
    await fs.mkdir(targetBasePath, { recursive: true });
    logger.debug('reset-vault.ts', `Ensured target base directory exists: ${targetBasePath}`);
  } catch (error) {
    logger.error('reset-vault.ts', `Error creating target base directory: ${error}`);
    throw error;
  }
  
  // Construct the content and assets paths with absolute paths
  const contentPath = path.join(targetBasePath, settings.contentPath);
  const assetsPath = path.join(targetBasePath, settings.assetsPath);
  
  logger.debug('reset-vault.ts', `Deleting content directory: ${contentPath}`);
  await deleteDirectoryIfExists(contentPath, logger);
  
  logger.debug('reset-vault.ts', `Deleting assets directory: ${assetsPath}`);
  await deleteDirectoryIfExists(assetsPath, logger);
}

/**
 * Delete a directory if it exists
 */
async function deleteDirectoryIfExists(dirPath: string, logger: Logger): Promise<void> {
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
    logger.debug('reset-vault.ts', `Deleted directory: ${dirPath}`);
  } catch (error) {
    // Check if it's because the directory doesn't exist
    if (error.code !== 'ENOENT') {
      // If it's a different error, log and rethrow
      logger.error('reset-vault.ts', `Error deleting directory ${dirPath}: ${error}`);
      throw error;
    }
    
    logger.debug('reset-vault.ts', `Directory does not exist: ${dirPath}`);
  }
}

/**
 * Queue all files in the vault for syncing
 */
async function queueAllFiles(
  app: App,
  syncEngine: SyncEngine,
  logger: Logger
): Promise<void> {
  logger.info('reset-vault.ts', 'Queuing all files for sync');
  
  // Get all files in the vault
  const files = app.vault.getAllLoadedFiles();
  
  // Filter to just TFiles (not folders)
  const tFiles = files.filter(file => file instanceof TFile) as TFile[];
  
  logger.debug('reset-vault.ts', `Found ${tFiles.length} files to process`);
  
  // Sort so that meta files are processed first
  const sortedFiles = tFiles.sort((a, b) => {
    const aIsMeta = a.name.endsWith('_meta.md');
    const bIsMeta = b.name.endsWith('_meta.md');
    
    if (aIsMeta && !bIsMeta) return -1;
    if (!aIsMeta && bIsMeta) return 1;
    return 0;
  });
  
  // Process each file
  for (const file of sortedFiles) {
    // Determine file type
    const fileType = getFileType(file);
    
    // Create event object
    const event: FileEvent = {
      name: file.name,
      path: file.path,
      type: fileType,
      action: 'create',
      timestamp: Date.now()
    };
    
    // Add content for appropriate file types
    if (fileType === 'markdown' || fileType === 'meta') {
      try {
        // Use cachedRead for better performance
        event.content = await app.vault.cachedRead(file);
      } catch (error) {
        logger.error('reset-vault.ts', `Error reading file content: ${error}`);
      }
    }
    
    // Queue event for processing
    syncEngine.queueEvent(event);
    
    logger.debug('reset-vault.ts', `Queued file for processing: ${file.path}`);
  }
  
  logger.info('reset-vault.ts', `Queued ${sortedFiles.length} files for processing`);
}

/**
 * Determine the type of a file
 */
function getFileType(file: TFile): FileEvent['type'] {
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