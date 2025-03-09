// src/core/reset-vault.ts
import { App, TFile } from 'obsidian';
import { createSyncEngine } from './sync-engine';
import { Logger, SyncSettings } from '../types';
import * as path from 'path';
import { createFileSystem } from '../utils/file-system';
import { createFileEvent, getFileType } from '../adapters/obsidian-adapter';
import { shouldExclude } from './sync-engine';

interface ResetVaultOptions {
  readonly app: App;
  readonly syncEngine: ReturnType<typeof createSyncEngine>;
  readonly settings: SyncSettings;
  readonly logger?: Logger;
}

interface ResetVaultResult {
  readonly success: boolean;
  readonly processedCount: number;
  readonly error?: Error;
}

const initializeDirectories = async (
  settings: SyncSettings,
  fs: ReturnType<typeof createFileSystem>,
  logger?: Logger
): Promise<void> => {
  const contentDirPath = path.join(settings.targetBasePath, settings.contentPath);
  const assetsDirPath = path.join(settings.targetBasePath, settings.assetsPath);

  logger?.info('reset-vault', `Ensuring directories exist`);
  await fs.createDirectory(contentDirPath);
  await fs.createDirectory(assetsDirPath);
};

const processVaultFiles = async (
  options: ResetVaultOptions
): Promise<number> => {
  const { app, syncEngine, settings, logger } = options;
  const allFiles = app.vault.getFiles();
  let processedCount = 0;

  for (const file of allFiles) {
    if (shouldExclude(file.path, settings, logger)) {
      logger?.debug('reset-vault', `Skipping excluded file: ${file.path}`);
      continue;
    }

    const event = await createFileEvent(app, file, 'create', undefined, logger);
    console.log('🔄 event', event);
    syncEngine.queueEvent(event);
    processedCount++;
  }

  return processedCount;
};

export const resetVault = async (options: ResetVaultOptions): Promise<ResetVaultResult> => {
  const { logger } = options;
  
  try {
    logger?.info('reset-vault', 'Starting vault reset process');
    
    const fs = createFileSystem(logger);
    await initializeDirectories(options.settings, fs, logger);
    
    const processedCount = await processVaultFiles(options);
    
    logger?.info('reset-vault', `Queued ${processedCount} files for processing`);
    logger?.info('reset-vault', 'Vault reset completed successfully');

    return {
      success: true,
      processedCount
    };
  } catch (error) {
    logger?.error('reset-vault', `Failed to reset vault: ${error}`);
    return {
      success: false,
      processedCount: 0,
      error: error instanceof Error ? error : new Error(String(error))
    };
  }
};