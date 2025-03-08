// src/core/sync-engine.ts
import { FileEvent, FileSystem, Rule, SyncSettings, TransformContext } from '../types';
import * as path from 'path';
import { 
  applyRules, 
  findAffectedPaths, 
  recalculateTargetPath, 
  updateAssetMap, 
  updateMetaCache 
} from './rule-engine';
import { parseMetaContent, transformContent } from '../rules/generic-rules';

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
  
  constructor(fs: FileSystem, settings: SyncSettings, rules: Rule[] = []) {
    this.fs = fs;
    this.settings = settings;
    this.rules = [...rules];
    
    // Initialize transform context
    this.context = {
      metaCache: new Map(),
      assetMap: new Map(),
      settings
    };
  }
  
  // Add a rule
  addRule(rule: Rule): void {
    this.rules.push(rule);
  }
  
  // Queue an event for processing
  queueEvent(event: FileEvent): void {
    // Skip excluded paths
    if (this.shouldExclude(event.path)) {
      this.log(`Skipping excluded path: ${event.path}`);
      return;
    }
    
    this.log(`Queuing ${event.action} event for ${event.path}`);
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
    this.log(`Processing ${this.eventQueue.length} events`);
    
    try {
      // Sort by timestamp
      this.eventQueue.sort((a, b) => a.timestamp - b.timestamp);
      
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
      this.log(`Error processing queue: ${error}`, 'error');
    } finally {
      this.processing = false;
      this.timeoutId = null;
    }
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
    this.log(`Slug changed for ${dirPath}: ${oldSlug} -> ${newSlug}`);
    
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
      this.log(`Error processing event: ${error}`, 'error');
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
    
    // Ensure directory exists
    await this.fs.createDirectory(path.dirname(targetPath));
    
    // Write file
    await this.fs.writeFile(targetPath, content);
    
    // Update path mapping
    this.pathMap.set(event.path, targetPath);
    
    this.log(`${event.action === 'create' ? 'Created' : 'Updated'} file: ${targetPath}`);
  }
  
  // Delete a file
  private async deleteFile(sourcePath: string): Promise<void> {
    const targetPath = this.pathMap.get(sourcePath);
    if (!targetPath) return;
    
    const exists = await this.fs.exists(targetPath);
    if (exists) {
      await this.fs.deleteFile(targetPath);
      this.log(`Deleted file: ${targetPath}`);
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
    
    this.log(`Moved file: ${oldPath} -> ${newPath}`);
  }
  
  // Check if a path should be excluded
  private shouldExclude(filePath: string): boolean {
    return this.settings.excludePaths.some(excludePath => 
      filePath.startsWith(excludePath)
    );
  }
  
  // Logging helper
  private log(message: string, level: 'info' | 'error' = 'info'): void {
    if (this.settings.debug || level === 'error') {
      const prefix = level === 'error' ? '[ERROR]' : '[INFO]';
      console.log(`${prefix} SyncEngine: ${message}`);
    }
  }
}