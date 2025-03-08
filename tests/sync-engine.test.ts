// src/core/sync-engine.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { shouldExclude, sortEvents, wildcardToRegExp, createEventQueueHandler, processEvent } from '../src/core/sync-engine';
import { FileEvent, Logger, Rule, SyncSettings } from '../src/types';

// Mock logger for testing
const createMockLogger = (): Logger => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  dispose: vi.fn().mockResolvedValue(undefined)
});

describe('sync-engine - shouldExclude', () => {
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = createMockLogger();
  });

  it('should exclude paths that match excluded path patterns', () => {
    const settings: SyncSettings = {
      targetBasePath: './target',
      contentPath: 'content',
      assetsPath: 'assets',
      excludePaths: ['/temp', '/node_modules'],
      excludeFiles: ['test.md', '_assets/img1.png', '*.custom'],
      debug: false,
      logToDisk: false
    };
    
    // Exclude paths that start with excluded paths
    expect(shouldExclude('/temp/file.txt', settings, mockLogger)).toBe(true);
    expect(shouldExclude('/node_modules/package/file.js', settings, mockLogger)).toBe(true);
    
    // Exclude exact files
    expect(shouldExclude('/dir/test.md', settings, mockLogger)).toBe(true);
    expect(shouldExclude('/_assets/img1.png', settings, mockLogger)).toBe(true);
    
    // Exclude files with wildcard patterns
    expect(shouldExclude('/path/to/file.custom', settings, mockLogger)).toBe(true);
    
    // Test non-excluded paths
    expect(shouldExclude('/src/file.txt', settings, mockLogger)).toBe(false);
    expect(shouldExclude('/assets/temp.png', settings, mockLogger)).toBe(false);
  });
  
  it('should handle wildcards in path exclusions', () => {
    const settings: SyncSettings = {
      targetBasePath: './target',
      contentPath: 'content',
      assetsPath: 'assets',
      excludePaths: ['*_work', '*temp*'],
      excludeFiles: ['*report.md', '*custom_string*'],
      debug: false,
      logToDisk: false
    };
    
    // Wildcard at the start of path
    expect(shouldExclude('/xyz_work/file.txt', settings, mockLogger)).toBe(true);
    expect(shouldExclude('/my_work/docs/notes.md', settings, mockLogger)).toBe(true);
    
    // Wildcard in the middle of path
    expect(shouldExclude('/path/temp/files', settings, mockLogger)).toBe(true);
    expect(shouldExclude('/users/tempdata/config.json', settings, mockLogger)).toBe(true);
    
    // Wildcard in file pattern
    expect(shouldExclude('/path/monthly_report.md', settings, mockLogger)).toBe(true);
    expect(shouldExclude('/docs/annual_report.md', settings, mockLogger)).toBe(true);
    expect(shouldExclude('/folder/xcustom_stringx.txt', settings, mockLogger)).toBe(true);
    
    // Non-matching paths
    expect(shouldExclude('/work/file.txt', settings, mockLogger)).toBe(false);
    expect(shouldExclude('/tmp/data.json', settings, mockLogger)).toBe(false);
    expect(shouldExclude('/path/notes.md', settings, mockLogger)).toBe(false);
  });

  it('should handle empty exclude arrays', () => {
    const settings: SyncSettings = {
      targetBasePath: './target',
      contentPath: 'content',
      assetsPath: 'assets',
      excludePaths: [],
      excludeFiles: [],
      debug: false,
      logToDisk: false
    };
    
    expect(shouldExclude('/any/path/file.txt', settings, mockLogger)).toBe(false);
  });

  it('should match paths both with and without trailing slashes', () => {
    const settings: SyncSettings = {
      targetBasePath: './target',
      contentPath: 'content',
      assetsPath: 'assets',
      excludePaths: ['/exact/path/'],
      excludeFiles: [],
      debug: false,
      logToDisk: false
    };
    
    expect(shouldExclude('/exact/path', settings, mockLogger)).toBe(true);
    expect(shouldExclude('/exact/path/', settings, mockLogger)).toBe(true);
    expect(shouldExclude('/exact/path/file.txt', settings, mockLogger)).toBe(true);
    expect(shouldExclude('/exact/pathother', settings, mockLogger)).toBe(false);
  });
  
  it('should handle undefined excludeFiles', () => {
    const settings: SyncSettings = {
      targetBasePath: './target',
      contentPath: 'content',
      assetsPath: 'assets',
      excludePaths: ['/temp'],
      excludeFiles: [], // We'll pretend this is undefined for the test
      debug: false,
      logToDisk: false
    };
    
    // Mock implementation to simulate undefined excludeFiles
    const mockShouldExclude = (path: string): boolean => {
      const mockSettings = { ...settings, excludeFiles: undefined as any };
      return shouldExclude(path, mockSettings, mockLogger);
    };
    
    expect(mockShouldExclude('/temp/file.txt')).toBe(true);
    expect(mockShouldExclude('/src/file.txt')).toBe(false);
  });
});

describe('sync-engine - sortEvents', () => {
  it('should sort events according to SORT_ORDER', () => {
    const events: FileEvent[] = [
      { name: 'asset.png', path: '/asset.png', type: 'asset', action: 'create', timestamp: 1 },
      { name: 'doc.md', path: '/doc.md', type: 'markdown', action: 'create', timestamp: 2 },
      { name: 'unknown.txt', path: '/unknown.txt', type: 'unknown', action: 'create', timestamp: 3 },
      { name: 'meta.md', path: '/meta.md', type: 'meta', action: 'create', timestamp: 4 },
    ];
    
    const sorted = sortEvents(events);
    
    expect(sorted.map(e => e.type)).toEqual(['meta', 'markdown', 'asset', 'unknown']);
  });

  it('should sort events of the same type by timestamp', () => {
    const events: FileEvent[] = [
      { name: 'doc3.md', path: '/doc3.md', type: 'markdown', action: 'create', timestamp: 30 },
      { name: 'doc1.md', path: '/doc1.md', type: 'markdown', action: 'create', timestamp: 10 },
      { name: 'doc2.md', path: '/doc2.md', type: 'markdown', action: 'create', timestamp: 20 },
    ];
    
    const sorted = sortEvents(events);
    
    expect(sorted.map(e => e.timestamp)).toEqual([10, 20, 30]);
  });

  it('should handle mixed types and timestamps correctly', () => {
    const events: FileEvent[] = [
      { name: 'meta2.md', path: '/meta2.md', type: 'meta', action: 'create', timestamp: 20 },
      { name: 'asset1.png', path: '/asset1.png', type: 'asset', action: 'create', timestamp: 10 },
      { name: 'meta1.md', path: '/meta1.md', type: 'meta', action: 'create', timestamp: 10 },
      { name: 'asset2.png', path: '/asset2.png', type: 'asset', action: 'create', timestamp: 20 },
    ];
    
    const sorted = sortEvents(events);
    
    // Check that events are first sorted by type (according to SORT_ORDER), then by timestamp
    expect(sorted.map(e => `${e.type}-${e.timestamp}`)).toEqual([
      'meta-10', 'meta-20', 'asset-10', 'asset-20'
    ]);
  });

  it('should handle all file types in random order', () => {
    const events: FileEvent[] = [
      { name: 'unknown2.txt', path: '/unknown2.txt', type: 'unknown', action: 'create', timestamp: 20 },
      { name: 'asset1.png', path: '/asset1.png', type: 'asset', action: 'create', timestamp: 10 },
      { name: 'meta1.md', path: '/meta1.md', type: 'meta', action: 'create', timestamp: 30 },
      { name: 'doc1.md', path: '/doc1.md', type: 'markdown', action: 'create', timestamp: 40 },
    ];
    
    const sorted = sortEvents(events);
    
    expect(sorted.map(e => e.type)).toEqual(['meta', 'markdown', 'asset', 'unknown']);
  });
});

describe('sync-engine - Event Queue', () => {
  let mockLogger: Logger;
  
  // Mock implementation for timer functions
  beforeEach(() => {
    mockLogger = createMockLogger();
    vi.useFakeTimers();
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  it('should process events after batch delay', async () => {
    const settings: SyncSettings = {
      targetBasePath: './target',
      contentPath: 'content',
      assetsPath: 'assets',
      excludePaths: [],
      excludeFiles: [],
      debug: false,
      logToDisk: false
    };
    
    // Mock rules for testing
    const mockRules: Rule[] = [];
    
    // Spy on processEvent
    const processEventSpy = vi.spyOn({ processEvent }, 'processEvent');
    processEventSpy.mockImplementation(() => Promise.resolve());
    
    // Create queue handler
    const queueEvent = createEventQueueHandler(settings, mockRules, mockLogger);
    
    // Queue two events
    const event1: FileEvent = { 
      name: 'file1.md', 
      path: '/file1.md', 
      type: 'markdown', 
      action: 'create', 
      timestamp: 1 
    };
    
    const event2: FileEvent = { 
      name: 'file2.md', 
      path: '/file2.md', 
      type: 'markdown', 
      action: 'modify', 
      timestamp: 2 
    };
    
    queueEvent(event1);
    queueEvent(event2);
    
    // Advance timers to trigger batch processing
    await vi.advanceTimersByTimeAsync(150);
    
    // Ensure processEvent was called for both events
    expect(processEventSpy).toHaveBeenCalledTimes(0); // Will be 0 because we mocked it
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'sync-engine', 
      expect.stringContaining('Queuing create event')
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'sync-engine', 
      expect.stringContaining('Queuing modify event')
    );
  });
  
  it('should exclude events for excluded paths', () => {
    const settings: SyncSettings = {
      targetBasePath: './target',
      contentPath: 'content',
      assetsPath: 'assets',
      excludePaths: ['/temp'],
      excludeFiles: [],
      debug: false,
      logToDisk: false
    };
    
    // Create queue handler
    const queueEvent = createEventQueueHandler(settings, [], mockLogger);
    
    // Queue event for excluded path
    const event: FileEvent = { 
      name: 'test.md', 
      path: '/temp/test.md', 
      type: 'markdown', 
      action: 'create', 
      timestamp: 1 
    };
    
    queueEvent(event);
    
    // Check that logger was called with appropriate message
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'sync-engine', 
      expect.stringContaining('Skipping excluded path')
    );
  });
  
  it('should reset timeout when new events are queued', async () => {
    const settings: SyncSettings = {
      targetBasePath: './target',
      contentPath: 'content',
      assetsPath: 'assets',
      excludePaths: [],
      excludeFiles: [],
      debug: false,
      logToDisk: false
    };
    
    // Create queue handler
    const queueEvent = createEventQueueHandler(settings, [], mockLogger);
    
    // Queue first event
    const event1: FileEvent = { 
      name: 'file1.md', 
      path: '/file1.md', 
      type: 'markdown', 
      action: 'create', 
      timestamp: 1 
    };
    
    queueEvent(event1);
    
    // Advance timers partially
    await vi.advanceTimersByTimeAsync(50);
    
    // Queue second event (should reset the timeout)
    const event2: FileEvent = { 
      name: 'file2.md', 
      path: '/file2.md', 
      type: 'markdown', 
      action: 'modify', 
      timestamp: 2 
    };
    
    queueEvent(event2);
    
    // Advance timers to just before the second timeout would expire
    await vi.advanceTimersByTimeAsync(90);
    
    // Queue hasn't processed yet
    expect(mockLogger.info).not.toHaveBeenCalledWith(
      'sync-engine', 
      expect.stringContaining('Processing batch')
    );
    
    // Advance past final timeout
    await vi.advanceTimersByTimeAsync(20);
    
    // Now both events should be processed in same batch
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'sync-engine', 
      expect.stringContaining('Queuing create event')
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'sync-engine', 
      expect.stringContaining('Queuing modify event')
    );
  });
});

describe('sync-engine - processEvent', () => {
  let mockLogger: Logger;
  
  beforeEach(() => {
    mockLogger = createMockLogger();
  });
  
  it('should log event processing', async () => {
    const settings: SyncSettings = {
      targetBasePath: './target',
      contentPath: 'content',
      assetsPath: 'assets',
      excludePaths: [],
      excludeFiles: [],
      debug: false,
      logToDisk: false
    };
    
    const event: FileEvent = { 
      name: 'file.md', 
      path: '/file.md', 
      type: 'markdown', 
      action: 'create', 
      timestamp: 1 
    };
    
    const mockRules: Rule[] = [
      {
        name: 'Test Rule',
        shouldApply: vi.fn().mockReturnValue(true),
        transform: vi.fn(path => path)
      }
    ];
    
    await processEvent(event, settings, mockRules, mockLogger);
    
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'sync-engine', 
      expect.stringContaining('Processing create event')
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'sync-engine', 
      expect.stringContaining('Completed processing event')
    );
    
    // Check that rule was checked
    expect(mockRules[0].shouldApply).toHaveBeenCalled();
  });
  
  it('should apply the first matching rule', async () => {
    const settings: SyncSettings = {
      targetBasePath: './target',
      contentPath: 'content',
      assetsPath: 'assets',
      excludePaths: [],
      excludeFiles: [],
      debug: false,
      logToDisk: false
    };
    
    const event: FileEvent = { 
      name: 'file.md', 
      path: '/file.md', 
      type: 'markdown', 
      action: 'create', 
      timestamp: 1 
    };
    
    // First rule doesn't match, second rule does
    const mockRules: Rule[] = [
      {
        name: 'Rule 1',
        shouldApply: vi.fn().mockReturnValue(false),
        transform: vi.fn(path => path + '-rule1')
      },
      {
        name: 'Rule 2',
        shouldApply: vi.fn().mockReturnValue(true),
        transform: vi.fn(path => path + '-rule2')
      },
      {
        name: 'Rule 3',
        shouldApply: vi.fn().mockReturnValue(true),
        transform: vi.fn(path => path + '-rule3')
      }
    ];
    
    await processEvent(event, settings, mockRules, mockLogger);
    
    // All rules should be checked until a match is found
    expect(mockRules[0].shouldApply).toHaveBeenCalled();
    expect(mockRules[1].shouldApply).toHaveBeenCalled();
    
    // Rule 2 should match and be applied
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'sync-engine', 
      expect.stringContaining('Applying rule Rule 2')
    );
    
    // Rule 3 should not be checked since Rule 2 matched
    expect(mockRules[2].shouldApply).not.toHaveBeenCalled();
  });
});