// src/core/sync-manager.ts
import { SyncEvent, SyncSettings, DEFAULT_SETTINGS, FileSystem } from '../types';
import { RuleEngine } from './rule-engine';
import { GenericRule } from '../rules/generic-rule';
import { LanguageRule } from '../rules/language-rule';
import * as path from 'path';
import * as fs from 'fs/promises';

export class SyncManager {
  private eventQueue: SyncEvent[] = [];
  private processing = false;
  private timeoutId: NodeJS.Timeout | null = null;
  private fs: FileSystem;
  private settings: SyncSettings;
  private ruleEngine: RuleEngine;

  constructor(
    settings: Partial<SyncSettings> = {}, 
    fileSystem: FileSystem = {
      mkdir: fs.mkdir,
      writeFile: fs.writeFile,
      readFile: fs.readFile,
      rm: fs.rm,
      access: async (path) => {
        try {
          await fs.access(path);
          return true;
        } catch {
          return false;
        }
      }
    }
  ) {
    this.settings = { ...DEFAULT_SETTINGS, ...settings };
    this.fs = fileSystem;
    
    // Initialize rule engine
    this.ruleEngine = new RuleEngine(this.settings);
    
    // Register default rules
    this.ruleEngine.registerRule(new GenericRule());
    this.ruleEngine.registerRule(new LanguageRule());
    
    this.log('SyncManager initialized with rules: ' + this.ruleEngine.getActiveRules().join(', '));
  }

  // Add an event to the queue
  async queueEvent(event: SyncEvent): Promise<void> {
    if (this.shouldSkipFile(event.path)) {
      this.log(`Skipping excluded file: ${event.path}`);
      return;
    }

    this.log(`Queueing ${event.action} event for ${event.path}`);
    this.eventQueue.push(event);

    // Clear existing timeout if there is one
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    // Set a new timeout to process the queue
    this.timeoutId = setTimeout(() => this.processQueue(), 100);
  }

  // Process all events in the queue
  private async processQueue(): Promise<void> {
    if (this.processing || this.eventQueue.length === 0) {
      return;
    }

    this.processing = true;
    this.log(`Processing ${this.eventQueue.length} events`);
    
    try {
      // Sort queue by timestamp to handle events in order
      this.eventQueue.sort((a, b) => a.timestamp - b.timestamp);
      
      // Handle meta files first to populate the meta cache
      await this.preProcessMetaFiles();
      
      // Process each event
      while (this.eventQueue.length > 0) {
        const event = this.eventQueue.shift();
        if (event) {
          await this.processEvent(event);
        }
      }
    } catch (error) {
      this.log(`Error processing queue: ${error}`, 'error');
    } finally {
      this.processing = false;
      this.timeoutId = null;
    }
  }
  
  // Pre-process meta files to populate cache
  private async preProcessMetaFiles(): Promise<void> {
    // Find meta files in the queue
    const metaFiles = this.eventQueue.filter(event => 
      event.type === 'meta' && 
      (event.action === 'create' || event.action === 'modify') &&
      event.content
    );
    
    // Parse and cache meta content
    for (const metaEvent of metaFiles) {
      if (metaEvent.content) {
        try {
          // Extract YAML frontmatter
          const frontmatterMatch = metaEvent.content.match(/^---\s*([\s\S]*?)\s*---/);
          
          if (frontmatterMatch && frontmatterMatch[1]) {
            // Parse YAML manually (simple key-value pairs only)
            const meta: Record<string, any> = {};
            const lines = frontmatterMatch[1].split('\n');
            
            for (const line of lines) {
              const [key, ...valueParts] = line.split(':');
              if (key && valueParts.length > 0) {
                const value = valueParts.join(':').trim();
                meta[key.trim()] = value;
              }
            }
            
            // Update meta cache
            const dirPath = path.dirname(metaEvent.path);
            this.ruleEngine.updateMetaCache(dirPath, meta);
            
            this.log(`Parsed meta file: ${metaEvent.path}`);
          }
        } catch (error) {
          this.log(`Error parsing meta file ${metaEvent.path}: ${error}`, 'error');
        }
      }
    }
  }

  // Process a single event
  private async processEvent(event: SyncEvent): Promise<void> {
    try {
      // Apply rules to determine target path
      const transformedEvent = this.ruleEngine.applyRules(event);
      
      switch (transformedEvent.action) {
        case 'create':
        case 'modify':
          await this.createOrUpdateFile(transformedEvent);
          break;
        case 'delete':
          await this.deleteFile(transformedEvent);
          break;
        case 'rename':
          await this.renameFile(transformedEvent);
          break;
      }
    } catch (error) {
      this.log(`Error processing event ${event.action} for ${event.path}: ${error}`, 'error');
    }
  }

  // Create or update a file in the target location
  private async createOrUpdateFile(event: SyncEvent): Promise<void> {
    // Create directory structure if needed
    await this.createDirectory(path.dirname(event.path));
    
    // Write the file content
    const content = event.content || '';
    await this.fs.writeFile(event.path, content, 'utf8');
    
    this.log(`${event.action === 'create' ? 'Created' : 'Updated'} file: ${event.path}`);
  }

  // Delete a file from the target location
  private async deleteFile(event: SyncEvent): Promise<void> {
    // Check if the file exists
    const exists = await this.fs.access(event.path);
    if (exists) {
      await this.fs.rm(event.path, { force: true });
      this.log(`Deleted file: ${event.path}`);
    } else {
      this.log(`File does not exist, skipping delete: ${event.path}`);
    }
  }

  // Rename a file in the target location
  private async renameFile(event: SyncEvent): Promise<void> {
    if (!event.oldPath) {
      this.log(`Missing oldPath for rename event: ${event.path}`, 'error');
      return;
    }
    
    // Apply rules to old path
    const oldEvent = { ...event, path: event.oldPath, action: 'delete' as const };
    const transformedOldEvent = this.ruleEngine.applyRules(oldEvent);
    
    // Check if the old file exists
    const exists = await this.fs.access(transformedOldEvent.path);
    if (!exists) {
      // If old file doesn't exist, just create the new one
      await this.createOrUpdateFile(event);
      return;
    }
    
    // Create directory structure for new path
    await this.createDirectory(path.dirname(event.path));
    
    // Read old file content
    const content = await this.fs.readFile(transformedOldEvent.path, 'utf8');
    
    // Write to new location
    await this.fs.writeFile(event.path, content, 'utf8');
    
    // Delete old file
    await this.fs.rm(transformedOldEvent.path, { force: true });
    
    this.log(`Renamed file: ${transformedOldEvent.path} → ${event.path}`);
  }

  // Create a directory, including parent directories
  private async createDirectory(dirPath: string): Promise<void> {
    try {
      await this.fs.mkdir(dirPath, { recursive: true });
    } catch (error: any) {
      // Ignore if directory already exists
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  // Check if a file should be skipped (in excluded paths)
  private shouldSkipFile(filePath: string): boolean {
    return this.settings.excludePaths.some(excludePath => 
      filePath.startsWith(excludePath)
    );
  }

  // Logging helper
  private log(message: string, level: 'info' | 'error' = 'info'): void {
    if (this.settings.debugMode || level === 'error') {
      const prefix = level === 'error' ? '[ERROR]' : '[INFO]';
      console.log(`${prefix} SyncManager: ${message}`);
    }
  }
  
  // Public method to allow registering custom rules
  registerRule(rule: any): void {
    this.ruleEngine.registerRule(rule);
  }
  
  // Update settings
  updateSettings(settings: Partial<SyncSettings>): void {
    this.settings = { ...this.settings, ...settings };
    this.ruleEngine.updateContext(this.settings);
    this.log('Settings updated');
  }
}