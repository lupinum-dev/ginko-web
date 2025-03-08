// src/core/sync-engine.ts
import { FileEvent, FileSystem, Rule, SyncSettings, SORT_ORDER } from '../types';
import * as path from 'path';
import { Logger } from '../utils/logger';
import { time } from 'console';



// Main sync engine - this remains a class for organizational purposes
export class SyncEngine {
  private settings: SyncSettings;
  private rules: Rule[];
  private eventQueue: FileEvent[] = [];
  private processing = false;
  private timeoutId: NodeJS.Timeout | null = null;
  private logger?: Logger;
  private fs: FileSystem;
  
  constructor(
    fs: FileSystem, 
    settings: SyncSettings, 
    rules: Rule[] = [],
    logger?: Logger
  ) {
    this.fs = fs;
    this.settings = settings;
    this.rules = [...rules];
    this.logger = logger;
    
    this.logger?.debug('sync-engine.ts', 'SyncEngine initialized');
  }
  
  // Add a rule
  addRule(rule: Rule): void {
    this.rules.push(rule);
    this.logger?.debug('sync-engine.ts', `Added rule: ${rule.name}`);
  }
  
  // Queue an event for processing
  queueEvent(event: FileEvent): void {
    // Skip excluded paths
    if (this.shouldExclude(event.path)) {
      this.logger?.debug('sync-engine.ts', `Skipping excluded path: ${event.path}`);
      return;
    }
    
    this.logger?.debug('sync-engine.ts', `Queuing ${event.action} event for ${event.path}`);
    this.eventQueue.push(event);
    
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
    
    this.timeoutId = setTimeout(() => this.processQueue(), 100);
  }
  
  // Process all queued events
  private async processQueue(): Promise<void> {
    if (this.processing || this.eventQueue.length === 0) {
      return;
    }
    
    this.processing = true;
    this.logger?.info('sync-engine.ts', `Processing ${this.eventQueue.length} events`);
    
    try {
      // Take current batch of events
      const currentBatch = [...this.eventQueue];
      this.eventQueue = [];
      
      // Sort the current batch
      const sortedBatch = await this.sortQueue(currentBatch);
      
      // Process each event in the sorted batch sequentially
      for (const event of sortedBatch) {
        this.logger?.debug('sync-engine.ts', `Processing event: ${event.action} for ${event.path}`);
        await processEvent([event]); // Process single event at a time
      }
      
      // If new events were queued during processing, process them next
      if (this.eventQueue.length > 0) {
        this.logger?.debug('sync-engine.ts', `New events queued during processing, starting next batch`);
        await this.processQueue();
      }
    } catch (error) {
      this.logger?.error('sync-engine.ts', `Error processing queue: ${error}`);
    } finally {
      this.processing = false;
      this.timeoutId = null;
    }
  }

  private async sortQueue(events: FileEvent[]): Promise<FileEvent[]> {
    const sortedEvents = events.sort((a, b) => {
      const aIndex = SORT_ORDER.indexOf(a.type);
      const bIndex = SORT_ORDER.indexOf(b.type);
      
      // First sort by type according to SORT_ORDER
      if (aIndex !== bIndex) {
        return aIndex - bIndex;
      }
      
      // Then sort by timestamp within same type
      return a.timestamp - b.timestamp;
    });
    return sortedEvents;
  }
  
  
  private shouldExclude(filePath: string): boolean {
    const normalizedPath = path.normalize(filePath);
    const fileName = path.basename(normalizedPath);
    
    // Check excluded paths
    if (this.settings.excludePaths) {
      for (const excludePath of this.settings.excludePaths) {
        const normalizedExcludePath = path.normalize(excludePath).replace(/\/$/, '');
        
        if (normalizedExcludePath.includes('*')) {
          const pattern = this.wildcardToRegExp(normalizedExcludePath);
          
          // Handle leading wildcard patterns differently
          if (normalizedExcludePath.startsWith('*')) {
            // Check if pattern matches any path component or full path
            const pathComponents = normalizedPath.split(path.sep);
            if (pathComponents.some(component => pattern.test(component)) || 
                pattern.test(normalizedPath)) {
              this.logger?.debug('sync-engine.ts', `Path ${filePath} excluded by pattern ${excludePath}`);
              return true;
            }
          } else if (pattern.test(normalizedPath)) {
            this.logger?.debug('sync-engine.ts', `Path ${filePath} excluded by pattern ${excludePath}`);
            return true;
          }
        } 
        // Simple path matching (exact or prefix)
        else if (normalizedPath === normalizedExcludePath || 
                 normalizedPath.startsWith(normalizedExcludePath + path.sep)) {
          this.logger?.debug('sync-engine.ts', `Path ${filePath} excluded by path ${excludePath}`);
          return true;
        }
      }
    }
    
    // Check excluded files
    if (this.settings.excludeFiles) {
      for (const excludeFile of this.settings.excludeFiles) {
        // Handle file paths (containing slashes)
        if (excludeFile.includes('/') || excludeFile.includes('\\')) {
          const normalizedExcludeFile = path.normalize(excludeFile);
          
          if (normalizedExcludeFile.includes('*')) {
            const pattern = this.wildcardToRegExp(normalizedExcludeFile);
            if (pattern.test(normalizedPath)) {
              this.logger?.debug('sync-engine.ts', `Path ${filePath} excluded by file pattern ${excludeFile}`);
              return true;
            }
          } else if (normalizedPath.endsWith(normalizedExcludeFile)) {
            this.logger?.debug('sync-engine.ts', `Path ${filePath} excluded by file path ${excludeFile}`);
            return true;
          }
        } 
        // Handle filenames or patterns
        else {
          if (excludeFile.includes('*')) {
            const pattern = this.wildcardToRegExp(excludeFile);
            if (pattern.test(fileName)) {
              this.logger?.debug('sync-engine.ts', `File ${fileName} excluded by pattern ${excludeFile}`);
              return true;
            }
          } else if (fileName === excludeFile) {
            this.logger?.debug('sync-engine.ts', `File ${fileName} excluded by name ${excludeFile}`);
            return true;
          }
        }
      }
    }
    
    return false;
  }
  
  private wildcardToRegExp(pattern: string): RegExp {
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
  }
}

export const processEvent = async (events: FileEvent[]): Promise<void> => {
  console.log('Starting to process events:', events);
  // random time between 250ms and 500ms
  const randomTime = Math.floor(Math.random() * 250) + 250;
  await new Promise(resolve => setTimeout(resolve, randomTime));
  console.log('Finished processing events:', events);
}