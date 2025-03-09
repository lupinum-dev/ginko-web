// src/core/sync-engine.ts
import { FileEvent, Logger, QueueState, Rule, SORT_ORDER, SyncSettings, FileSystem } from '../types';
import * as path from 'path';
import { processEvent } from './process-event';
import { createBatchCacheManager } from './cache-engine';

// Re-export processEvent for convenience
export { processEvent } from './process-event';

/**
 * Converts a wildcard pattern to a RegExp object
 */
export const wildcardToRegExp = (pattern: string): RegExp => {
  // Escape RegExp special characters except asterisk
  const escapedPattern = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  
  // Replace * with non-greedy wildcard matcher
  const regexPattern = escapedPattern.replace(/\*/g, '.*?');
  
  // For patterns with leading wildcard, don't force start of string
  if (pattern.startsWith('*')) {
    return new RegExp(regexPattern, 'i');
  }
  
  // For other patterns, match the entire string
  return new RegExp(`^${regexPattern}$`, 'i');
};

/**
 * Checks if a path matches a specific pattern
 */
const matchesPattern = (
  normalizedPath: string,
  fileName: string,
  pattern: string,
  isPathPattern: boolean,
  logger?: Logger
): boolean => {
  const normalizedPattern = path.normalize(pattern).replace(/\/$/, '');
  
  // Path matching logic
  if (isPathPattern) {
    // Handle wildcard patterns
    if (normalizedPattern.includes('*')) {
      const regexPattern = wildcardToRegExp(normalizedPattern);
      
      // Handle leading wildcard patterns
      if (normalizedPattern.startsWith('*')) {
        // Check if pattern matches any path component
        const pathComponents = normalizedPath.split(path.sep);
        if (pathComponents.some(component => regexPattern.test(component)) || 
            regexPattern.test(normalizedPath)) {
          logger?.debug('sync-engine', `Path ${normalizedPath} excluded by pattern ${pattern}`);
          return true;
        }
      } else if (regexPattern.test(normalizedPath)) {
        logger?.debug('sync-engine', `Path ${normalizedPath} excluded by pattern ${pattern}`);
        return true;
      }
    } 
    // Simple path matching (exact or prefix)
    else if (normalizedPath === normalizedPattern || 
              normalizedPath.startsWith(normalizedPattern + path.sep)) {
      logger?.debug('sync-engine', `Path ${normalizedPath} excluded by path ${pattern}`);
      return true;
    }
  } 
  // File matching logic
  else {
    // Handle file paths (containing slashes)
    if (pattern.includes('/') || pattern.includes('\\')) {
      const normalizedExcludeFile = path.normalize(pattern);
      
      if (normalizedExcludeFile.includes('*')) {
        const regexPattern = wildcardToRegExp(normalizedExcludeFile);
        if (regexPattern.test(normalizedPath)) {
          logger?.debug('sync-engine', `Path ${normalizedPath} excluded by file pattern ${pattern}`);
          return true;
        }
      } else if (normalizedPath.endsWith(normalizedExcludeFile)) {
        logger?.debug('sync-engine', `Path ${normalizedPath} excluded by file path ${pattern}`);
        return true;
      }
    } 
    // Handle filenames or patterns
    else {
      if (pattern.includes('*')) {
        const regexPattern = wildcardToRegExp(pattern);
        if (regexPattern.test(fileName)) {
          logger?.debug('sync-engine', `File ${fileName} excluded by pattern ${pattern}`);
          return true;
        }
      } else if (fileName === pattern) {
        logger?.debug('sync-engine', `File ${fileName} excluded by name ${pattern}`);
        return true;
      }
    }
  }
  
  return false;
};

/**
 * Checks if a path matches any of the provided patterns
 */
const matchesAnyPattern = (
  normalizedPath: string,
  fileName: string,
  patterns: string[],
  isPathPattern: boolean,
  logger?: Logger
): boolean => {
  for (const pattern of patterns) {
    if (matchesPattern(normalizedPath, fileName, pattern, isPathPattern, logger)) {
      return true;
    }
  }
  return false;
};

/**
 * Checks if a path should be excluded based on settings
 */
export const shouldExclude = (
  filePath: string, 
  settings: SyncSettings, 
  logger?: Logger
): boolean => {
  const normalizedPath = path.normalize(filePath);
  const fileName = path.basename(normalizedPath);
  
  // Check excluded paths
  if (settings.excludePaths && matchesAnyPattern(normalizedPath, fileName, settings.excludePaths, true, logger)) {
    return true;
  }
  
  // Check excluded files
  if (settings.excludeFiles && matchesAnyPattern(normalizedPath, fileName, settings.excludeFiles, false, logger)) {
    return true;
  }
  
  return false;
};

/**
 * Sorts events by file type and timestamp
 */
export const sortEvents = (events: ReadonlyArray<FileEvent>): ReadonlyArray<FileEvent> => {
  return [...events].sort((a, b) => {
    const aIndex = SORT_ORDER.indexOf(a.type);
    const bIndex = SORT_ORDER.indexOf(b.type);
    
    // First sort by type according to SORT_ORDER
    if (aIndex !== bIndex) {
      return aIndex - bIndex;
    }
    
    // Then sort by timestamp within same type
    return a.timestamp - b.timestamp;
  });
};

/**
 * Processes a batch of events
 */
export const processBatch = async (
  events: ReadonlyArray<FileEvent>,
  settings: SyncSettings,
  rules: ReadonlyArray<Rule>,
  logger?: Logger,
  fileSystem?: FileSystem
): Promise<void> => {
  if (events.length === 0) return;
  
  logger?.info('sync-engine', `Processing batch of ${events.length} events`);
  
  // Create cache manager and start batch
  const cacheManager = createBatchCacheManager();
  cacheManager.startBatch();
  
  try {
    // Process each event sequentially
    for (const event of sortEvents(events)) {
      await processEvent(event, settings, rules, cacheManager, logger, fileSystem);
    }
    
    // Save caches after batch completion
    cacheManager.completeBatch();
  } catch (error) {
    // Still try to save caches even if there was an error
    cacheManager.completeBatch();
    throw error;
  }
  
  logger?.info('sync-engine', `Completed processing batch of ${events.length} events`);
};

/**
 * Creates a function that adds an event to the queue
 */
export const createEventQueueHandler = (
  settings: SyncSettings,
  rules: ReadonlyArray<Rule>,
  logger?: Logger,
  fileSystem?: FileSystem
) => {
  // State for the queue (will be updated immutably)
  let queueState: QueueState = {
    events: [],
    isProcessing: false
  };
  
  // Timeout for batch processing
  let batchTimeout: NodeJS.Timeout | null = null;
  
  /**
   * Processes the current queue
   */
  const processQueue = async (): Promise<void> => {
    // If already processing or queue is empty, do nothing
    if (queueState.isProcessing || queueState.events.length === 0) {
      return;
    }
    
    // Update state to mark as processing and take the current events
    const currentEvents = [...queueState.events];
    queueState = {
      events: [],
      isProcessing: true
    };
    
    try {
      // Process the batch, passing the fileSystem parameter
      await processBatch(currentEvents, settings, rules, logger, fileSystem);
    } catch (error) {
      logger?.error('sync-engine', `Error processing batch: ${error}`);
    } finally {
      // Update state after processing
      queueState = {
        ...queueState,
        isProcessing: false
      };
      
      // If new events were queued during processing, process them next
      if (queueState.events.length > 0) {
        logger?.debug('sync-engine', `New events queued during processing, starting next batch`);
        scheduleBatchProcessing();
      }
    }
  };
  
  /**
   * Schedules a batch for processing after a delay
   */
  const scheduleBatchProcessing = (): void => {
    // Clear any existing timeout
    if (batchTimeout) {
      clearTimeout(batchTimeout);
    }
    
    // Set new timeout
    batchTimeout = setTimeout(() => {
      batchTimeout = null;
      processQueue();
    }, 100);
  };
  
  /**
   * Adds an event to the queue
   */
  return (event: FileEvent): void => {
    // Skip excluded paths
    if (shouldExclude(event.path, settings, logger)) {
      logger?.debug('sync-engine', `Skipping excluded path: ${event.path}`);
      return;
    }
    
    logger?.debug('sync-engine', `Queuing ${event.action} event for ${event.path}`);
    
    // Add event to queue (immutably)
    queueState = {
      ...queueState,
      events: [...queueState.events, event]
    };
    
    // Schedule batch processing
    scheduleBatchProcessing();
  };
};

/**
 * Creates a sync engine
 */
export const createSyncEngine = (
  settings: SyncSettings, 
  initialRules: ReadonlyArray<Rule> = [],
  logger?: Logger,
  fileSystem?: FileSystem
) => {
  // Store rules immutably
  let rules = [...initialRules];
  
  // Create queue handler with optional fileSystem
  const queueEvent = createEventQueueHandler(settings, rules, logger, fileSystem);
  
  logger?.debug('sync-engine', 'Created sync engine');
  
  return {
    // Add a rule to the engine
    addRule: (rule: Rule): void => {
      rules = [...rules, rule];
      logger?.debug('sync-engine', `Added rule: ${rule.name}`);
    },
    
    // Queue an event for processing
    queueEvent,
    
    // Get rules (for testing/debugging)
    getRules: (): ReadonlyArray<Rule> => [...rules]
  };
};