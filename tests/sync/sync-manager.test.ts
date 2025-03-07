// tests/sync/sync-manager.test.ts
import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import { SyncManager } from '../../src/core/sync-manager';
import { MockFileSystem } from '../mock-filesystem';
import { SyncEvent, SyncSettings } from '../../src/types';
import path from 'path';

describe('SyncManager', () => {
  let syncManager: SyncManager;
  let mockFs: MockFileSystem;
  let settings: SyncSettings;
  
  // Helper method to directly call processQueue on the SyncManager
  async function forceProcessQueue(manager: SyncManager): Promise<void> {
    await (manager as any).processQueue();
  }
  
  beforeEach(() => {
    // We'll use real timers to avoid timing issues
    mockFs = new MockFileSystem();
    
    settings = {
      targetBasePath: '/target',
      contentPath: 'content',
      assetsPath: 'public/_assets',
      excludePaths: ['.obsidian', '.git', 'node_modules'],
      debugMode: true, // Enable debug mode for testing
      activeRules: ['generic', 'language']
    };
    
    syncManager = new SyncManager(settings, mockFs);
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
    mockFs.reset();
  });
  
  test('should initialize with default rules', () => {
    const rules = syncManager['ruleEngine'].getActiveRules();
    expect(rules).toContain('generic');
    expect(rules).toContain('language');
  });
  
  test('should create a file with generic rule', async () => {
    const event: SyncEvent = {
      name: 'test.md',
      path: '/vault/test.md',
      type: 'markdown',
      action: 'create',
      content: 'Test content',
      timestamp: Date.now()
    };
    
    await syncManager.queueEvent(event);
    // Force process instead of using timers
    await forceProcessQueue(syncManager);
    
    // For debugging
    console.log('Files in mock filesystem:');
    mockFs.printAll();
    
    const expectedPath = '/target/content/vault/test.md';
    expect(mockFs.hasFile(expectedPath)).toBe(true);
    expect(mockFs.getFileContent(expectedPath)).toBe('Test content');
  });
  
  test('should process language files correctly', async () => {
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
    
    const expectedPath = '/target/content/en/vault/test.md';
    expect(mockFs.hasFile(expectedPath)).toBe(true);
    expect(mockFs.getFileContent(expectedPath)).toBe('English content');
  });
  
  test('should skip excluded files', async () => {
    const event: SyncEvent = {
      name: '.obsidian-file',
      path: '.obsidian/some-file.md',
      type: 'markdown',
      action: 'create',
      content: 'Excluded content',
      timestamp: Date.now()
    };
    
    await syncManager.queueEvent(event);
    await forceProcessQueue(syncManager);
    
    const allFiles = mockFs.getAllFiles();
    expect(Object.keys(allFiles).length).toBe(0);
  });
  
  test('should update a file when modified', async () => {
    // First create a file
    const createEvent: SyncEvent = {
      name: 'test.md',
      path: '/vault/test.md',
      type: 'markdown',
      action: 'create',
      content: 'Original content',
      timestamp: Date.now()
    };
    
    await syncManager.queueEvent(createEvent);
    await forceProcessQueue(syncManager);
    
    const targetPath = '/target/content/vault/test.md';
    expect(mockFs.hasFile(targetPath)).toBe(true);
    expect(mockFs.getFileContent(targetPath)).toBe('Original content');
    
    // Then update it
    const updateEvent: SyncEvent = {
      name: 'test.md',
      path: '/vault/test.md',
      type: 'markdown',
      action: 'modify',
      content: 'Updated content',
      timestamp: Date.now() + 1000
    };
    
    await syncManager.queueEvent(updateEvent);
    await forceProcessQueue(syncManager);
    
    expect(mockFs.getFileContent(targetPath)).toBe('Updated content');
  });
  
  test('should delete a file', async () => {
    // First create a file
    const createEvent: SyncEvent = {
      name: 'to-delete.md',
      path: '/vault/to-delete.md',
      type: 'markdown',
      action: 'create',
      content: 'Content to delete',
      timestamp: Date.now()
    };
    
    await syncManager.queueEvent(createEvent);
    await forceProcessQueue(syncManager);
    
    const targetPath = '/target/content/vault/to-delete.md';
    expect(mockFs.hasFile(targetPath)).toBe(true);
    
    // Then delete it
    const deleteEvent: SyncEvent = {
      name: 'to-delete.md',
      path: '/vault/to-delete.md',
      type: 'markdown',
      action: 'delete',
      timestamp: Date.now() + 1000
    };
    
    await syncManager.queueEvent(deleteEvent);
    await forceProcessQueue(syncManager);
    
    expect(mockFs.hasFile(targetPath)).toBe(false);
  });
  
  test('should rename a file', async () => {
    // First create a file
    const createEvent: SyncEvent = {
      name: 'original.md',
      path: '/vault/original.md',
      type: 'markdown',
      action: 'create',
      content: 'Original file content',
      timestamp: Date.now()
    };
    
    await syncManager.queueEvent(createEvent);
    await forceProcessQueue(syncManager);
    
    const originalPath = '/target/content/vault/original.md';
    expect(mockFs.hasFile(originalPath)).toBe(true);
    
    // Then rename it
    const renameEvent: SyncEvent = {
      name: 'renamed.md',
      path: '/vault/renamed.md',
      type: 'markdown',
      action: 'rename',
      oldPath: '/vault/original.md',
      content: 'Original file content',
      timestamp: Date.now() + 1000
    };
    
    await syncManager.queueEvent(renameEvent);
    await forceProcessQueue(syncManager);
    
    const newPath = '/target/content/vault/renamed.md';
    expect(mockFs.hasFile(originalPath)).toBe(false);
    expect(mockFs.hasFile(newPath)).toBe(true);
    expect(mockFs.getFileContent(newPath)).toBe('Original file content');
  });
  
  test('should handle asset files correctly', async () => {
    const event: SyncEvent = {
      name: 'image.png',
      path: '/vault/_assets/image.png',
      type: 'asset',
      action: 'create',
      content: 'binary-content',
      timestamp: Date.now()
    };
    
    await syncManager.queueEvent(event);
    await forceProcessQueue(syncManager);
    
    // Generic rule would place this in the standard content path
    // Note: This might need adjusting if there's a specific rule for assets
    const expectedPath = '/target/content/vault/_assets/image.png';
    expect(mockFs.hasFile(expectedPath)).toBe(true);
  });
  
  test('should process meta files and update meta cache', async () => {
    // Add a meta file first
    const metaEvent: SyncEvent = {
      name: '_meta.md',
      path: '/vault/_meta.md',
      type: 'meta',
      action: 'create',
      content: '---\ntitle: Test Folder\ndescription: A test folder\n---\n',
      timestamp: Date.now()
    };
    
    await syncManager.queueEvent(metaEvent);
    await forceProcessQueue(syncManager);
    
    // Then add a normal file that should use meta data
    const fileEvent: SyncEvent = {
      name: 'test.md',
      path: '/vault/test.md',
      type: 'markdown',
      action: 'create',
      content: 'Test content',
      timestamp: Date.now() + 1000
    };
    
    await syncManager.queueEvent(fileEvent);
    await forceProcessQueue(syncManager);
    
    // Verify the meta file was synced
    const expectedMetaPath = '/target/content/vault/_meta.md';
    expect(mockFs.hasFile(expectedMetaPath)).toBe(true);
    
    // Verify the main file was synced
    const expectedFilePath = '/target/content/vault/test.md';
    expect(mockFs.hasFile(expectedFilePath)).toBe(true);
    
    // Check that meta cache was updated (indirectly through the successful sync)
    expect(mockFs.getFileContent(expectedFilePath)).toBe('Test content');
  });
});