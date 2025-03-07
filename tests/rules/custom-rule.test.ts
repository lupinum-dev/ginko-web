// tests/rules/custom-rule.test.ts
import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import { SyncManager } from '../../src/core/sync-manager';
import { MockFileSystem } from '../mock-filesystem';
import { SyncEvent, SyncSettings, Rule, RuleContext } from '../../src/types';
import path from 'path';

/**
 * Custom rule that prefixes filenames with their type
 * Example: test.md -> prefix-md-test.md
 */
class PrefixRule implements Rule {
  name = 'prefix';
  priority = 75; // Higher than language rule
  
  shouldApply(event: SyncEvent): boolean {
    // Apply to all markdown files
    return event.type === 'markdown';
  }
  
  apply(event: SyncEvent, context: RuleContext): SyncEvent {
    // Don't modify if already processed
    if (event.path.includes(context.targetBasePath)) {
      return event;
    }
    
    const dirPath = path.dirname(event.path);
    const fileName = path.basename(event.path);
    const extension = path.extname(fileName);
    const baseName = path.basename(fileName, extension);
    
    // Create a prefix based on the file extension (without the dot)
    const prefix = extension ? `prefix-${extension.substring(1)}-` : 'prefix-';
    const newFileName = `${prefix}${baseName}${extension}`;
    
    // Create new path
    const newPath = path.join(dirPath, newFileName);
    
    return {
      ...event,
      path: newPath,
      name: newFileName
    };
  }
}

/**
 * Custom rule that organizes files by type in subdirectories
 * Example: file.md -> markdown/file.md
 */
class TypeFolderRule implements Rule {
  name = 'type-folder';
  priority = 25; // Lower than language rule
  
  shouldApply(event: SyncEvent): boolean {
    return true; // Apply to all files
  }
  
  apply(event: SyncEvent, context: RuleContext): SyncEvent {
    // Don't modify if already processed
    if (event.path.includes(context.targetBasePath)) {
      return event;
    }
    
    let typeFolder = '';
    
    // Determine folder based on file type
    switch(event.type) {
      case 'markdown':
        typeFolder = 'docs';
        break;
      case 'meta':
        typeFolder = 'meta';
        break;
      case 'asset':
        typeFolder = 'assets';
        break;
      default:
        typeFolder = 'other';
    }
    
    const dirPath = path.dirname(event.path);
    const fileName = path.basename(event.path);
    
    // Create new path with type folder
    const newPath = path.join(dirPath, typeFolder, fileName);
    
    return {
      ...event,
      path: newPath
    };
  }
}

describe('Custom Rules with SyncManager', () => {
  let syncManager: SyncManager;
  let mockFs: MockFileSystem;
  let settings: SyncSettings;
  
  // Helper method to directly call processQueue on the SyncManager
  async function forceProcessQueue(manager: SyncManager): Promise<void> {
    await (manager as any).processQueue();
  }
  
  beforeEach(() => {
    mockFs = new MockFileSystem();
    
    settings = {
      targetBasePath: '/target',
      contentPath: 'content',
      assetsPath: 'public/_assets',
      excludePaths: ['.obsidian', '.git', 'node_modules'],
      debugMode: true, // Enable debug mode for testing
      activeRules: ['generic']
    };
    
    syncManager = new SyncManager(settings, mockFs);
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
    mockFs.reset();
  });

  test('should apply a custom rule correctly', async () => {
    // Register a custom rule
    syncManager.registerRule(new PrefixRule());
    
    // Update active rules
    syncManager.updateSettings({
      activeRules: ['generic', 'prefix']
    });
    
    // Create a test file
    const event: SyncEvent = {
      name: 'test.md',
      path: '/vault/test.md',
      type: 'markdown',
      action: 'create',
      content: 'Test content',
      timestamp: Date.now()
    };
    
    await syncManager.queueEvent(event);
    await forceProcessQueue(syncManager);
    
    // For debugging
    console.log('Files in mock filesystem:');
    mockFs.printAll();
    
    // The prefix rule should change the filename, and the generic rule will handle placement
    const expectedPath = '/target/content/vault/prefix-md-test.md';
    expect(mockFs.hasFile(expectedPath)).toBe(true);
    expect(mockFs.getFileContent(expectedPath)).toBe('Test content');
  });
  
  test('should apply multiple custom rules in priority order', async () => {
    // Register two custom rules
    syncManager.registerRule(new PrefixRule());
    syncManager.registerRule(new TypeFolderRule());
    
    // Update active rules
    syncManager.updateSettings({
      activeRules: ['generic', 'prefix', 'type-folder']
    });
    
    // Create a test file
    const event: SyncEvent = {
      name: 'test.md',
      path: '/vault/test.md',
      type: 'markdown',
      action: 'create',
      content: 'Test content',
      timestamp: Date.now()
    };
    
    await syncManager.queueEvent(event);
    await forceProcessQueue(syncManager);
    
    // PrefixRule (priority 75) runs first, changing the filename
    // TypeFolderRule (priority 25) runs next, adding a type folder
    // GenericRule (priority 0) runs last, placing in the target location
    
    const expectedPath = '/target/content/vault/docs/prefix-md-test.md';
    expect(mockFs.hasFile(expectedPath)).toBe(true);
    expect(mockFs.getFileContent(expectedPath)).toBe('Test content');
  });
  
  test('should work with language rule and custom rules together', async () => {
    // Register custom rule and enable language rule
    syncManager.registerRule(new PrefixRule());
    
    // Update active rules
    syncManager.updateSettings({
      activeRules: ['generic', 'language', 'prefix']
    });
    
    // Create a language-specific file
    const event: SyncEvent = {
      name: 'test__en.md',
      path: '/vault/test__en.md',
      type: 'markdown',
      action: 'create',
      content: 'English content',
      timestamp: Date.now()
    };
    
    await syncManager.queueEvent(event);
    await forceProcessQueue(syncManager);
    
    // The prefix rule (priority 75) runs first, changing filename
    // The language rule (priority 50) runs next, handling language placement
    // The generic rule (priority 0) runs last, placing in target location
    
    // Because prefix runs before language rule, the filename should be prefixed before 
    // language rule extracts the base name and language code
    const expectedPath = '/target/content/en/vault/prefix-md-test.md';
    expect(mockFs.hasFile(expectedPath)).toBe(true);
    expect(mockFs.getFileContent(expectedPath)).toBe('English content');
  });
  
  test('should allow disabling specific rules', async () => {
    // Register custom rules
    syncManager.registerRule(new PrefixRule());
    syncManager.registerRule(new TypeFolderRule());
    
    // Update active rules - we'll only activate the generic and type-folder rules
    syncManager.updateSettings({
      activeRules: ['generic', 'type-folder']
    });
    
    // Create a test file
    const event: SyncEvent = {
      name: 'test.md',
      path: '/vault/test.md',
      type: 'markdown',
      action: 'create',
      content: 'Test content',
      timestamp: Date.now()
    };
    
    await syncManager.queueEvent(event);
    await forceProcessQueue(syncManager);
    
    // The prefix rule should be skipped
    // The type-folder rule should add the docs folder
    // The generic rule should handle placement
    
    const expectedPath = '/target/content/vault/docs/test.md';
    expect(mockFs.hasFile(expectedPath)).toBe(true);
    expect(mockFs.getFileContent(expectedPath)).toBe('Test content');
    
    // The prefixed path should not exist
    const prefixedPath = '/target/content/vault/docs/prefix-md-test.md';
    expect(mockFs.hasFile(prefixedPath)).toBe(false);
  });
  
  test('should allow changing rule order through settings', async () => {
    // Create a test file with initial settings
    const event1: SyncEvent = {
      name: 'file1.md',
      path: '/vault/file1.md',
      type: 'markdown',
      action: 'create',
      content: 'Content 1',
      timestamp: Date.now()
    };
    
    await syncManager.queueEvent(event1);
    await forceProcessQueue(syncManager);
    
    // File should be placed using generic rule
    expect(mockFs.hasFile('/target/content/vault/file1.md')).toBe(true);
    
    // Register custom rules and update settings
    syncManager.registerRule(new PrefixRule());
    syncManager.registerRule(new TypeFolderRule());
    
    // First test with one ordering
    syncManager.updateSettings({
      activeRules: ['generic', 'prefix', 'type-folder']
    });
    
    const event2: SyncEvent = {
      name: 'file2.md',
      path: '/vault/file2.md',
      type: 'markdown',
      action: 'create',
      content: 'Content 2',
      timestamp: Date.now() + 1000
    };
    
    await syncManager.queueEvent(event2);
    await forceProcessQueue(syncManager);
    
    // With this order, prefix (p75) runs first, then type-folder (p25), then generic (p0)
    expect(mockFs.hasFile('/target/content/vault/docs/prefix-md-file2.md')).toBe(true);
    
    // Now change the active rules order (although actual execution order is still by priority)
    syncManager.updateSettings({
      activeRules: ['type-folder', 'generic', 'prefix']
    });
    
    const event3: SyncEvent = {
      name: 'file3.md',
      path: '/vault/file3.md',
      type: 'markdown',
      action: 'create',
      content: 'Content 3',
      timestamp: Date.now() + 2000
    };
    
    await syncManager.queueEvent(event3);
    await forceProcessQueue(syncManager);
    
    // The order in activeRules doesn't change the execution order,
    // which is still determined by priority, so result should be the same
    expect(mockFs.hasFile('/target/content/vault/docs/prefix-md-file3.md')).toBe(true);
  });
});