// src/core/sync-engine-integration.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processEvent } from '../src/core/process-event';
import { createSyncEngine } from '../src/core/sync-engine';
import { FileEvent, FileSystem, Logger, SyncSettings } from '../src/types';
import { createSyncRules } from '../src/core/rules-engine';
import { createMockFileSystem } from '../src/utils/file-system';

/**
 * Helper to create a mock logger for testing
 */
const createMockLogger = (): Logger => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  dispose: vi.fn().mockResolvedValue(undefined)
});

/**
 * Helper to create file event objects for testing
 */
const createEvent = (
  action: 'create' | 'modify' | 'delete' | 'rename',
  name: string,
  path: string,
  type: 'markdown' | 'asset' | 'meta' | 'unknown',
  content?: string,
  oldPath?: string
): FileEvent => ({
  name,
  path,
  type,
  action,
  oldPath,
  content,
  timestamp: Date.now()
});

describe('Sync Engine Integration', () => {
  let mockLogger: Logger;
  let mockFs: FileSystem;
  let settings: SyncSettings;
  
  beforeEach(() => {
    mockLogger = createMockLogger();
    mockFs = createMockFileSystem(mockLogger);
    
    settings = {
      obsidianRoot: '/obsidian',
      targetBasePathUser: './target',
      targetBasePath: './target',
      contentPathUser: 'content',
      contentPath: 'content',
      assetsPathUser: 'public/assets',
      assetsPath: 'public/assets',
      excludePaths: ['.obsidian', 'node_modules'],
      excludeFiles: ['*.tmp'],
      debug: false,
      logToDisk: false
    };
  });
  
  describe('End-to-End File Processing', () => {
    it('should process a sequence of events correctly', async () => {
      // Create rules
      const rules = createSyncRules();
      
      // Create a sequence of events to simulate a workflow
      const events: FileEvent[] = [
        // Create a markdown file
        createEvent(
          'create',
          'document.md',
          '/notes/document.md',
          'markdown',
          '# My Document\n\nThis is a test document.'
        ),
        
        // Create a metadata file for it
        createEvent(
          'create',
          '_meta.md',
          '/notes/_meta.md',
          'markdown',
          '---\ntitle: My Document\ndate: 2023-01-01\n---'
        ),
        
        // Add an image
        createEvent(
          'create',
          'image.png',
          '/assets/image.png',
          'asset',
          'binary-image-content'
        ),
        
        // Modify the document
        createEvent(
          'modify',
          'document.md',
          '/notes/document.md',
          'markdown',
          '# My Document\n\nThis is a test document with updated content.'
        ),
        
        // Create a localized version
        createEvent(
          'create',
          'document__de.md',
          '/notes/document__de.md',
          'markdown',
          '# Mein Dokument\n\nDies ist ein Testdokument.'
        ),
        
        // Rename the original document
        createEvent(
          'rename',
          'updated-document.md',
          '/notes/updated-document.md',
          'markdown',
          '# My Document\n\nThis is a test document with updated content.',
          '/notes/document.md'
        )
      ];
      
      // Process each event
      for (const event of events) {
        await processEvent(event, settings, rules, mockLogger, mockFs);
      }
      
      // Check the final state of the mock file system
      
      // Original markdown file should be moved to the new name
      expect(await mockFs.exists('./target/content/notes/document.md')).toBe(false);
      expect(await mockFs.exists('./target/content/notes/updated-document.md')).toBe(true);
      
      // Content should be updated
      const documentContent = await mockFs.readFile('./target/content/notes/updated-document.md');
      expect(documentContent).toContain('updated content');
      
      // Metadata file should exist in the meta directory
      // expect(await mockFs.exists('./target/content/meta/notes/document_meta.md')).toBe(true);
      
      // Image should be in the assets directory
      expect(await mockFs.exists('./target/public/assets/image.png')).toBe(true);
      
      // German version should be in the de subdirectory
      expect(await mockFs.exists('./target/content/de/notes/document.md')).toBe(true);
      
      // German content should be preserved
      const germanContent = await mockFs.readFile('./target/content/de/notes/document.md');
      expect(germanContent).toContain('Mein Dokument');
    });
  });
  
  describe('Sync Engine Queue', () => {
    it('should queue and process events', async () => {
      // Create the sync engine
      const syncEngine = createSyncEngine(settings, createSyncRules(), mockLogger);
      
      // Mock implementation for processEvent to avoid actual file operations
      const processEventSpy = vi.spyOn({ processEvent }, 'processEvent');
      processEventSpy.mockImplementation(() => Promise.resolve());
      
      // Create a test event
      const event: FileEvent = {
        name: 'test.md',
        path: '/test.md',
        type: 'markdown',
        action: 'create',
        timestamp: Date.now()
      };
      
      // Queue the event
      syncEngine.queueEvent(event);
      
      // Advance timers to trigger processing
      vi.useFakeTimers();
      await vi.advanceTimersByTimeAsync(150);
      vi.useRealTimers();
      
      // Verify the event was queued
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'sync-engine',
        expect.stringContaining('Queuing create event')
      );
    });
    
    it('should exclude events for excluded paths', () => {
      // Create the sync engine
      const syncEngine = createSyncEngine({
        obsidianRoot: '/obsidian',
        targetBasePathUser: './target',
        targetBasePath: './target',
        contentPathUser: 'content',
        contentPath: 'content',
        assetsPathUser: 'public/assets',
        assetsPath: 'public/assets',
        excludePaths: ['.obsidian'],
        excludeFiles: ['*.tmp'],
        debug: false,
        logToDisk: false,
        logFilePath: '.obsidian/plugins/ginko'
      }, createSyncRules(), mockLogger);
      
      // Create an event for an excluded path
      const event: FileEvent = {
        name: 'config',
        path: '.obsidian/config',
        type: 'unknown',
        action: 'modify',
        timestamp: Date.now()
      };
      
      // Queue the event
      syncEngine.queueEvent(event);
      
      // Verify the event was skipped
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'sync-engine',
        expect.stringContaining('Skipping excluded path')
      );
    });
  });
  
  // describe('Rule Application Order', () => {
  //   it('should apply the highest priority matching rule', async () => {
  //     // Create rules
  //     const rules = createSyncRules();
      
  //     // Create an event that could match multiple rules
  //     const event: FileEvent = {
  //       name: 'document__de_meta.md',
  //       path: '/notes/document__de_meta.md',
  //       type: 'markdown',
  //       action: 'create',
  //       content: 'Test content with both language and meta markers',
  //       timestamp: Date.now()
  //     };
      
  //     // Process the event
  //     await processEvent(event, settings, rules, mockLogger, mockFs);
      
  //     // Metadata rule should have highest priority and be applied
  //     expect(await mockFs.exists('./target/content/meta/notes/document__de_meta.md')).toBe(true);
      
  //     // Localized markdown rule should not be applied
  //     expect(await mockFs.exists('./target/content/de/notes/document__de_meta.md')).toBe(false);
  //   });
  // });
});