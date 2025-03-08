// src/core/sync-engine.ts
import { FileEvent, FileSystem, FileType, Rule, SyncSettings, TransformContext, SORT_ORDER } from '../types';
import * as path from 'path';
import { 
  applyRules, 
  findAffectedPaths, 
  recalculateTargetPath, 
  updateAssetMap, 
  updateMetaCache 
} from './rule-engine';
import { parseMetaContent, transformContent } from '../rules/generic-rules';
import { Logger } from '../utils/logger';



// Main sync engine - this remains a class for organizational purposes
export class SyncEngine {
  private fs: FileSystem;
  private settings: SyncSettings;
  private rules: Rule[];
  private context: TransformContext;
  private pathMap: Map<string, string> = new Map();
  private eventQueue: FileEvent[] = [];
  private processing = false;
  private timeoutId: NodeJS.Timeout | null = null;
  private logger: Logger;
  
  constructor(
    fs: FileSystem, 
    settings: SyncSettings, 
    rules: Rule[] = [],
    logger: Logger
  ) {
    this.fs = fs;
    this.settings = settings;
    this.rules = [...rules];
    this.logger = logger;
    
    // Initialize transform context
    this.context = {
      metaCache: new Map(),
      assetMap: new Map(),
      settings
    };
    
    this.logger.debug('sync-engine.ts', 'SyncEngine initialized');
  }
  
  // Add a rule
  addRule(rule: Rule): void {
    this.rules.push(rule);
    this.logger.debug('sync-engine.ts', `Added rule: ${rule.name}`);
  }
  
  // Queue an event for processing
  queueEvent(event: FileEvent): void {
    // Skip excluded paths
    if (this.shouldExclude(event.path)) {
      this.logger.debug('sync-engine.ts', `Skipping excluded path: ${event.path}`);
      return;
    }
    
    this.logger.debug('sync-engine.ts', `Queuing ${event.action} event for ${event.path}`);
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
    this.logger.info('sync-engine.ts', `Processing ${this.eventQueue.length} events`);
    
    try {
      // Sort the queue by event type 
      this.eventQueue = await this.sortQueue(this.eventQueue);
      
      // Process meta files first to update context
      const metaEvents = this.eventQueue.filter(e => e.type === 'meta');
      for (const event of metaEvents) {
        await this.processMetaEvent(event);
      }
      
      // Process remaining events
      const otherEvents = this.eventQueue.filter(e => e.type !== 'meta');
      for (const event of otherEvents) {
        await this.processEvent(event);
      }
      
      // Clear queue
      this.eventQueue = [];
    } catch (error) {
      this.logger.error('sync-engine.ts', `Error processing queue: ${error}`);
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
  
  // Process a meta file event
  private async processMetaEvent(event: FileEvent): Promise<void> {
    const dirPath = path.dirname(event.path);
    
    if (event.action === 'delete') {
      // Remove meta info from context
      const newContext = {
        ...this.context,
        metaCache: new Map(this.context.metaCache)
      };
      newContext.metaCache.delete(dirPath);
      this.context = newContext;
      
      this.logger.debug('sync-engine.ts', `Removed meta cache for ${dirPath}`);
      return;
    }
    
    if (!event.content) return;
    
    // Parse meta content
    const newMeta = parseMetaContent(event.content);
    if (!newMeta) return;
    
    // Get old meta if it exists
    const oldMeta = this.context.metaCache.get(dirPath);
    
    // Update meta cache
    this.context = updateMetaCache(dirPath, newMeta, this.context);
    
    this.logger.debug('sync-engine.ts', `Updated meta cache for ${dirPath}`);
    
    // If slug changed, update affected files
    if (oldMeta?.slug !== newMeta.slug && oldMeta?.slug && newMeta.slug) {
      await this.handleSlugChange(dirPath, oldMeta.slug, newMeta.slug);
    }
  }
  
  // Handle a slug change by moving affected files
  private async handleSlugChange(
    dirPath: string, 
    oldSlug: string, 
    newSlug: string
  ): Promise<void> {
    this.logger.info('sync-engine.ts', `Slug changed for ${dirPath}: ${oldSlug} -> ${newSlug}`);
    
    // Find affected source paths
    const affectedPaths = findAffectedPaths(dirPath, this.pathMap);
    
    // Move each affected file
    for (const sourcePath of affectedPaths) {
      const oldTargetPath = this.pathMap.get(sourcePath);
      if (!oldTargetPath) continue;
      
      // Calculate new target path
      const newTargetPath = recalculateTargetPath(
        sourcePath,
        { 
          name: path.basename(sourcePath),
          path: sourcePath,
          type: 'markdown', // Assume markdown
          action: 'modify',
          timestamp: Date.now()
        },
        this.rules,
        this.context
      );
      
      if (oldTargetPath !== newTargetPath) {
        // Move the file
        await this.moveFile(oldTargetPath, newTargetPath);
        
        // Update path mapping
        this.pathMap.set(sourcePath, newTargetPath);
      }
    }
  }
  
  // Process a non-meta file event
  private async processEvent(event: FileEvent): Promise<void> {
    try {
      // Calculate target path using rules
      const targetPath = applyRules(event, this.rules, this.context);
      
      switch (event.action) {
        case 'create':
        case 'modify':
          await this.createOrUpdateFile(event, targetPath);
          break;
        case 'delete':
          await this.deleteFile(event.path);
          break;
        case 'rename':
          if (event.oldPath) {
            const oldTargetPath = this.pathMap.get(event.oldPath) || 
                                applyRules({
                                  ...event,
                                  path: event.oldPath,
                                  action: 'delete'
                                }, this.rules, this.context);
            
            await this.renameFile(event, oldTargetPath, targetPath);
          }
          break;
      }
    } catch (error) {
      this.logger.error('sync-engine.ts', `Error processing event: ${error}`);
    }
  }
  
  // Create or update a file
  private async createOrUpdateFile(event: FileEvent, targetPath: string): Promise<void> {
    let content = event.content || '';
    
    // Transform markdown content
    if (event.type === 'markdown' && content) {
      content = transformContent(content, this.context.assetMap);
    }
    
    // If it's an asset, update the asset map
    if (event.type === 'asset') {
      this.context = updateAssetMap(event.path, targetPath, this.context);
    }
    
    try {
      // Make sure targetPath is absolute
      const absoluteTargetPath = path.isAbsolute(targetPath) ? targetPath : path.resolve(targetPath);
      
      // Ensure directory exists
      const dirPath = path.dirname(absoluteTargetPath);
      this.logger.debug('sync-engine.ts', `Ensuring directory exists: ${dirPath}`);
      await this.fs.createDirectory(dirPath);
      
      // Write file
      await this.fs.writeFile(absoluteTargetPath, content);
      
      // Update path mapping
      this.pathMap.set(event.path, absoluteTargetPath);
      
      this.logger.info('sync-engine.ts', `${event.action === 'create' ? 'Created' : 'Updated'} file: ${absoluteTargetPath}`);
    } catch (error) {
      this.logger.error('sync-engine.ts', `Error creating/updating file ${targetPath}: ${error}`);
      throw error;
    }
  }
  
  // Delete a file
  private async deleteFile(sourcePath: string): Promise<void> {
    const targetPath = this.pathMap.get(sourcePath);
    if (!targetPath) return;
    
    const exists = await this.fs.exists(targetPath);
    if (exists) {
      await this.fs.deleteFile(targetPath);
      this.logger.info('sync-engine.ts', `Deleted file: ${targetPath}`);
    }
    
    // Remove from path mapping
    this.pathMap.delete(sourcePath);
  }
  
  // Rename a file
  private async renameFile(event: FileEvent, oldTargetPath: string, newTargetPath: string): Promise<void> {
    if (oldTargetPath === newTargetPath) return;
    
    const exists = await this.fs.exists(oldTargetPath);
    if (!exists) {
      // If old file doesn't exist, just create the new one
      await this.createOrUpdateFile(event, newTargetPath);
      return;
    }
    
    // Move the file
    await this.moveFile(oldTargetPath, newTargetPath);
    
    // Update path mapping
    if (event.oldPath) {
      this.pathMap.delete(event.oldPath);
    }
    this.pathMap.set(event.path, newTargetPath);
  }
  
  // Helper function to move a file
  private async moveFile(oldPath: string, newPath: string): Promise<void> {
    // Ensure directory exists
    await this.fs.createDirectory(path.dirname(newPath));
    
    // Move file
    await this.fs.moveFile(oldPath, newPath);
    
    this.logger.info('sync-engine.ts', `Moved file: ${oldPath} -> ${newPath}`);
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
              this.logger.debug('sync-engine.ts', `Path ${filePath} excluded by pattern ${excludePath}`);
              return true;
            }
          } else if (pattern.test(normalizedPath)) {
            this.logger.debug('sync-engine.ts', `Path ${filePath} excluded by pattern ${excludePath}`);
            return true;
          }
        } 
        // Simple path matching (exact or prefix)
        else if (normalizedPath === normalizedExcludePath || 
                 normalizedPath.startsWith(normalizedExcludePath + path.sep)) {
          this.logger.debug('sync-engine.ts', `Path ${filePath} excluded by path ${excludePath}`);
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
              this.logger.debug('sync-engine.ts', `Path ${filePath} excluded by file pattern ${excludeFile}`);
              return true;
            }
          } else if (normalizedPath.endsWith(normalizedExcludeFile)) {
            this.logger.debug('sync-engine.ts', `Path ${filePath} excluded by file path ${excludeFile}`);
            return true;
          }
        } 
        // Handle filenames or patterns
        else {
          if (excludeFile.includes('*')) {
            const pattern = this.wildcardToRegExp(excludeFile);
            if (pattern.test(fileName)) {
              this.logger.debug('sync-engine.ts', `File ${fileName} excluded by pattern ${excludeFile}`);
              return true;
            }
          } else if (fileName === excludeFile) {
            this.logger.debug('sync-engine.ts', `File ${fileName} excluded by name ${excludeFile}`);
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