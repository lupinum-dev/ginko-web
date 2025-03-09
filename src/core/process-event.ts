// src/core/process-event.ts
import { FileEvent, FileSystem, Logger, Rule, SyncSettings, TransformContext } from '../types';
import * as path from 'path';
import { createFileSystem } from '../utils/file-system';
import { createBatchCacheManager } from './cache-engine';

/**
 * Ensures path starts with './' if it doesn't already
 */
const normalizePath = (targetPath: string): string => {
  if (!targetPath.startsWith('./') && !targetPath.startsWith('/')) {
    return `./${targetPath}`;
  }
  return targetPath;
};

/**
 * Processes a single file event by applying rules and performing file operations
 * to keep the target directory in sync with the Obsidian vault.
 * 
 * @param event The file event to process
 * @param settings Sync settings
 * @param rules Array of rules to apply
 * @param cacheManager Batch cache manager
 * @param logger Optional logger for debugging
 * @param customFs Optional file system implementation (useful for testing)
 */
export const processEvent = async (
  event: FileEvent,
  settings: SyncSettings,
  rules: ReadonlyArray<Rule>,
  cacheManager: ReturnType<typeof createBatchCacheManager>,
  logger?: Logger,
  customFs?: FileSystem
): Promise<void> => {
  // Use provided file system or create a real one
  const fs = customFs || createFileSystem(logger);

  logger?.debug('sync-engine', `Processing ${event.action} event for ${event.path}`);
  
  // Use the current cache from the batch manager
  const { metaCache, assetCache } = cacheManager.getCurrentCache();
  
  // Create context for rule application
  const context: TransformContext = {
    metaCache,
    assetCache,
    settings
  };

  console.log('❌ context', context);
  
  // Find the first matching rule
  let matchingRule: Rule | undefined;
  let targetPath: string = '';
  
  for (const rule of rules) {
    if (rule.shouldApply(event, context)) {
      matchingRule = rule;
      if (rule.transformPath) {
        targetPath = rule.transformPath(event.path, context);
        targetPath = normalizePath(targetPath);
        logger?.debug('sync-engine', `Applying rule ${rule.name} to ${event.path} → ${targetPath}`);
      }
      break;
    }
  }
  
  // If no rule matches, use default behavior
  if (!matchingRule) {
    // Default transformation puts the file at the target base path with the same relative path
    const relativePath = event.path.startsWith('/') ? event.path.substring(1) : event.path;
    targetPath = path.join(settings.targetBasePath, relativePath);
    targetPath = normalizePath(targetPath);
    logger?.debug('sync-engine', `No matching rule, using default path: ${targetPath}`);
  }
  
  try {
    // Handle different event types
    switch (event.action) {
      case 'create':
        await handleCreateEvent(event, targetPath, fs, logger);
        break;
        
      case 'delete':
        await handleDeleteEvent(targetPath, fs, logger);
        break;
        
      case 'rename':
        if (!event.oldPath) {
          throw new Error(`Rename event missing oldPath: ${event.path}`);
        }
                

        
        await handleRenameEvent(event, event.oldPath, targetPath, fs, logger);
        break;
        
      case 'modify':
        await handleModifyEvent(event, targetPath, fs, logger);
        break;
        
      default:
        logger?.warn('sync-engine', `Unknown event action: ${event.action}`);
    }
    
    logger?.debug('sync-engine', `Completed processing event for ${event.path}`);
  } catch (error) {
    logger?.error('sync-engine', `Error processing event ${event.action} for ${event.path}: ${error}`);
    throw error;
  }
};

/**
 * Handles a file creation event
 */
const handleCreateEvent = async (
  event: FileEvent,
  targetPath: string,
  fs: FileSystem,
  logger?: Logger
): Promise<void> => {
  logger?.debug('sync-engine', `Handling create event: ${event.path} → ${targetPath}`);
  
  try {
    // Ensure target directory exists
    await ensureParentDirectoryExists(targetPath, fs, logger);
    
    // Check if we have content directly in the event
    if (event.content !== undefined) {
      // Write the content to the target path
      await fs.writeFile(targetPath, event.content);
      logger?.debug('sync-engine', `Created file from event content: ${targetPath}`);
    } else {
      // We need to read the content from the source
      try {
        const content = await fs.readFile(event.path);
        
        // Write the content to the target path
        await fs.writeFile(targetPath, content);
        logger?.debug('sync-engine', `Created file: ${targetPath}`);
      } catch (error) {
        logger?.error('sync-engine', `Failed to read source file for creation: ${event.path}`);
        throw error;
      }
    }
  } catch (error) {
    logger?.error('sync-engine', `Error handling create event: ${error}`);
    throw error;
  }
};

/**
 * Handles a file deletion event
 */
const handleDeleteEvent = async (
  targetPath: string,
  fs: FileSystem,
  logger?: Logger
): Promise<void> => {
  logger?.debug('sync-engine', `Handling delete event: ${targetPath}`);
  
  try {
    // Check if the file exists in the target first
    const exists = await fs.exists(targetPath);
    if (exists) {
      await fs.deleteFile(targetPath);
      logger?.debug('sync-engine', `Deleted file: ${targetPath}`);
    } else {
      logger?.debug('sync-engine', `File to delete doesn't exist in target: ${targetPath}`);
    }
  } catch (error) {
    logger?.error('sync-engine', `Error handling delete event: ${error}`);
    throw error;
  }
};

/**
 * Handles a file rename event
 */
const handleRenameEvent = async (
  event: FileEvent,
  oldTargetPath: string,
  newTargetPath: string,
  fs: FileSystem,
  logger?: Logger
): Promise<void> => {
  logger?.debug('sync-engine', `Handling rename event: ${oldTargetPath} → ${newTargetPath}`);
  
  try {
    // Ensure the target directory exists
    await ensureParentDirectoryExists(newTargetPath, fs, logger);
    
    // Move the file - if old file doesn't exist, fs.moveFile should throw appropriate error
    await fs.moveFile(oldTargetPath, newTargetPath);
    logger?.debug('sync-engine', `Renamed file: ${oldTargetPath} → ${newTargetPath}`);
  } catch (error) {
    logger?.error('sync-engine', `Error handling rename event: ${error}`);
    throw error;
  }
};

/**
 * Handles a file modification event
 */
const handleModifyEvent = async (
  event: FileEvent,
  targetPath: string,
  fs: FileSystem,
  logger?: Logger
): Promise<void> => {
  logger?.debug('sync-engine', `Handling modify event: ${event.path} → ${targetPath}`);
  
  try {
    // Check if target exists
    const exists = await fs.exists(targetPath);
    if (!exists) {
      logger?.warn('sync-engine', `Target file for modification doesn't exist: ${targetPath}`);
      // Handle as a create instead
      await handleCreateEvent(event, targetPath, fs, logger);
      return;
    }
    
    // Update the file content
    if (event.content !== undefined) {
      // Write the updated content
      await fs.writeFile(targetPath, event.content);
      logger?.debug('sync-engine', `Updated file from event content: ${targetPath}`);
    } else {
      // Read the updated content from source
      try {
        const content = await fs.readFile(event.path);
        
        // Write the updated content
        await fs.writeFile(targetPath, content);
        logger?.debug('sync-engine', `Updated file: ${targetPath}`);
      } catch (error) {
        logger?.error('sync-engine', `Failed to read source for update: ${event.path}`);
        throw error;
      }
    }
  } catch (error) {
    logger?.error('sync-engine', `Error handling modify event: ${error}`);
    throw error;
  }
};

/**
 * Ensures that the parent directory for a file exists
 */
export const ensureParentDirectoryExists = async (
  filePath: string,
  fs: FileSystem,
  logger?: Logger
): Promise<void> => {
  const dirPath = path.dirname(filePath);
  logger?.debug('sync-engine', `Ensuring directory exists: ${dirPath}`);
  
  const exists = await fs.exists(dirPath);
  if (!exists) {
    await fs.createDirectory(dirPath);
    logger?.debug('sync-engine', `Created directory: ${dirPath}`);
  }
};