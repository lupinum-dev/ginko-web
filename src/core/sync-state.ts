import { App } from 'obsidian';
import { Logger, SyncSettings } from '../types';
import { resetVault } from './reset-vault';
import { createSyncEngine } from './sync-engine';

interface SyncState {
  readonly isInSync: boolean;
  readonly lastSyncAttempt: number | null;
  readonly failedAttempts: number;
}

interface SyncStateConfig {
  readonly resyncCooldown: number;
  readonly maxFailedAttempts: number;
}

interface SyncStateManager {
  readonly getState: () => SyncState;
  readonly markOutOfSync: () => void;
  readonly markInSync: () => void;
  readonly attemptResync: (options: ResyncOptions) => Promise<ResyncResult>;
  readonly shouldAttemptResync: () => boolean;
}

interface ResyncOptions {
  readonly app: App;
  readonly syncEngine: ReturnType<typeof createSyncEngine>;
  readonly settings: SyncSettings;
  readonly logger?: Logger;
}

interface ResyncResult {
  readonly success: boolean;
  readonly error?: Error;
}

const DEFAULT_CONFIG: SyncStateConfig = {
  resyncCooldown: 10 * 1000, // 10 seconds
  maxFailedAttempts: 1
};

const createSyncStateManager = (config: SyncStateConfig = DEFAULT_CONFIG): SyncStateManager => {
  let state: SyncState = {
    isInSync: true,
    lastSyncAttempt: null,
    failedAttempts: 0
  };

  const updateState = (newState: Partial<SyncState>): void => {
    state = { ...state, ...newState };
  };

  return {
    getState: () => ({ ...state }),

    markOutOfSync: () => {
      updateState({ isInSync: false });
    },

    markInSync: () => {
      updateState({
        isInSync: true,
        lastSyncAttempt: null,
        failedAttempts: 0
      });
    },

    shouldAttemptResync: () => {
      if (state.isInSync) return false;
      if (state.failedAttempts >= config.maxFailedAttempts) return false;
      if (!state.lastSyncAttempt) return true;
      
      return Date.now() - state.lastSyncAttempt >= config.resyncCooldown;
    },

    attemptResync: async (options: ResyncOptions): Promise<ResyncResult> => {
      if (!state.isInSync && state.failedAttempts < config.maxFailedAttempts) {
        updateState({ lastSyncAttempt: Date.now() });

        try {
          const resetResult = await resetVault(options);
          
          if (resetResult.success) {
            updateState({
              isInSync: true,
              lastSyncAttempt: null,
              failedAttempts: 0
            });
            return { success: true };
          }

          updateState({
            failedAttempts: state.failedAttempts + 1
          });
          return { 
            success: false, 
            error: resetResult.error 
          };
        } catch (error) {
          updateState({
            failedAttempts: state.failedAttempts + 1
          });
          return { 
            success: false, 
            error: error instanceof Error ? error : new Error(String(error))
          };
        }
      }
      return { success: false };
    }
  };
};

export const syncStateManager = createSyncStateManager();

export const withSyncCheck = async <T>(
  operation: () => Promise<T>,
  options: ResyncOptions
): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    if (syncStateManager.shouldAttemptResync()) {
      syncStateManager.markOutOfSync();
      const resyncResult = await syncStateManager.attemptResync(options);
      
      if (resyncResult.success) {
        return await operation();
      }
      
      options.logger?.error('sync-state', `Resync failed: ${resyncResult.error}`);
      throw resyncResult.error;
    }
    throw error;
  }
};
