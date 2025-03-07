// tests/sync-manager.test.ts
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SyncManager } from '../src/core/sync-manager';
import { MockFileSystem } from './mock-filesystem';
import { SyncEvent } from '../src/types';

describe('SyncManager', () => {
  let syncManager: SyncManager;
  let mockFs: MockFileSystem;
  
  beforeEach(() => {
    // Clear mocks and setup fresh instances for each test
    vi.useFakeTimers();
    mockFs = new MockFileSystem();
    syncManager = new SyncManager({ debugMode: true }, mockFs);
  });
  
  afterEach(() => {
    vi.useRealTimers();
  });
  
  it('should create a file in target location', async () => {
    // Create a test event
    const event: SyncEvent = {
      name: 'test.md',
      path: 'folder/test.md',
      type: 'markdown',
      action: 'create',
      content: '# Test Content',
      timestamp: Date.now()
    };
    
    // Queue the event
    await syncManager.queueEvent(event);
    
    // Advance timers to trigger queue processing
    await vi.runAllTimersAsync();
    
    // Check if the file was created
    const files = mockFs.getFiles();
    const targetPath = 'target/folder/test.md';
    
    expect(files.has(targetPath)).toBe(true);
    expect(files.get(targetPath)?.content).toBe('# Test Content');
    expect(files.get(targetPath)?.isDirectory).toBe(false);
  });
  
  it('should update an existing file', async () => {
    // Setup: Create a file first
    await mockFs.writeFile('target/folder/test.md', 'Original content');
    
    // Create a modify event
    const event: SyncEvent = {
      name: 'test.md',
      path: 'folder/test.md',
      type: 'markdown',
      action: 'modify',
      content: 'Updated content',
      timestamp: Date.now()
    };
    
    // Queue the event
    await syncManager.queueEvent(event);
    
    // Advance timers
    await vi.runAllTimersAsync();
    
    // Check if the file was updated
    const files = mockFs.getFiles();
    const targetPath = 'target/folder/test.md';
    
    expect(files.has(targetPath)).toBe(true);
    expect(files.get(targetPath)?.content).toBe('Updated content');
  });
  
  it('should delete a file', async () => {
    // Setup: Create a file first
    await mockFs.writeFile('target/folder/test.md', 'Content to delete');
    
    // Create a delete event
    const event: SyncEvent = {
      name: 'test.md',
      path: 'folder/test.md',
      type: 'markdown',
      action: 'delete',
      timestamp: Date.now()
    };
    
    // Queue the event
    await syncManager.queueEvent(event);
    
    // Advance timers
    await vi.runAllTimersAsync();
    
    // Check if the file was deleted
    const files = mockFs.getFiles();
    const targetPath = 'target/folder/test.md';
    
    expect(files.has(targetPath)).toBe(false);
  });
  
  it('should rename a file', async () => {
    // Setup: Create a file first
    await mockFs.writeFile('target/folder/old.md', 'Content to rename');
    
    // Create a rename event
    const event: SyncEvent = {
      name: 'new.md',
      path: 'folder/new.md',
      type: 'markdown',
      action: 'rename',
      oldPath: 'folder/old.md',
      timestamp: Date.now()
    };
    
    // Queue the event
    await syncManager.queueEvent(event);
    
    // Advance timers
    await vi.runAllTimersAsync();
    
    // Check if the file was renamed
    const files = mockFs.getFiles();
    const oldPath = 'target/folder/old.md';
    const newPath = 'target/folder/new.md';
    
    expect(files.has(oldPath)).toBe(false);
    expect(files.has(newPath)).toBe(true);
    expect(files.get(newPath)?.content).toBe('Content to rename');
  });
  
  it('should process multiple events in queue order', async () => {
    // Create multiple events
    const events: SyncEvent[] = [
      {
        name: 'first.md',
        path: 'folder/first.md',
        type: 'markdown',
        action: 'create',
        content: 'First content',
        timestamp: 1 // Earlier timestamp
      },
      {
        name: 'second.md',
        path: 'folder/second.md',
        type: 'markdown',
        action: 'create',
        content: 'Second content',
        timestamp: 2 // Later timestamp
      }
    ];
    
    // Queue the events in reverse order
    await syncManager.queueEvent(events[1]);
    await syncManager.queueEvent(events[0]);
    
    // Advance timers only once
    await vi.runAllTimersAsync();
    
    // Check if both files were created in the correct order
    const files = mockFs.getFiles();
    expect(files.has('target/folder/first.md')).toBe(true);
    expect(files.has('target/folder/second.md')).toBe(true);
  });
  
  it('should skip files in excluded paths', async () => {
    // Create sync manager with .obsidian in excluded paths
    syncManager = new SyncManager({
      debugMode: true,
      excludePaths: ['.obsidian']
    }, mockFs);
    
    // Create an event for an excluded file
    const event: SyncEvent = {
      name: 'config.json',
      path: '.obsidian/config.json',
      type: 'unknown',
      action: 'create',
      content: '{}',
      timestamp: Date.now()
    };
    
    // Queue the event
    await syncManager.queueEvent(event);
    
    // Advance timers
    await vi.runAllTimersAsync();
    
    // Check that the file was not created
    const files = mockFs.getFiles();
    const targetPath = 'target/.obsidian/config.json';
    
    expect(files.has(targetPath)).toBe(false);
  });
});