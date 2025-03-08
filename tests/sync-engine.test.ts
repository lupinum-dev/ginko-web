// test the should exclude method from /core/sync-engine.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SyncEngine, processEvent } from '../src/core/sync-engine';
import { FileEvent, FileSystem, SyncSettings, SORT_ORDER } from '../src/types';
import { Logger } from '../src/utils/logger';

// Mock dependencies
const mockFs: FileSystem = {
  readFile: vi.fn(),
  writeFile: vi.fn(),
  exists: vi.fn(),
  createDirectory: vi.fn(),
  deleteFile: vi.fn(),
  moveFile: vi.fn(),
};



describe('SyncEngine - Queue - shouldExclude', () => {
  it('should exclude paths that match excluded path patterns', () => {
    const settings: Partial<SyncSettings> = {
      excludePaths: ['/temp', '/node_modules'],
      excludeFiles: ['test.md', '_assets/img1.png', '*.custom'],
    };
    
    const engine = new SyncEngine(mockFs, settings as SyncSettings, []);
    
    // Exclude paths that start with excluded paths
    expect(engine['shouldExclude']('/temp/file.txt')).toBe(true);
    expect(engine['shouldExclude']('/node_modules/package/file.js')).toBe(true);
    
    // Exclude exact files
    expect(engine['shouldExclude']('/dir/test.md')).toBe(true);
    expect(engine['shouldExclude']('/_assets/img1.png')).toBe(true);
    
    // Exclude files with wildcard patterns
    expect(engine['shouldExclude']('/path/to/file.custom')).toBe(true);
    
    // Test non-excluded paths
    expect(engine['shouldExclude']('/src/file.txt')).toBe(false);
    expect(engine['shouldExclude']('/assets/temp.png')).toBe(false);
  });
  
  it('should handle wildcards in path exclusions', () => {
    const settings: Partial<SyncSettings> = {
      excludePaths: ['*_work', '*temp*'],
      excludeFiles: ['*report.md', '*custom_string*'],
    };
    
    const engine = new SyncEngine(mockFs, settings as SyncSettings, []);
    
    // Wildcard at the start of path
    expect(engine['shouldExclude']('/xyz_work/file.txt')).toBe(true);
    expect(engine['shouldExclude']('/my_work/docs/notes.md')).toBe(true);
    
    // Wildcard in the middle of path
    expect(engine['shouldExclude']('/path/temp/files')).toBe(true);
    expect(engine['shouldExclude']('/users/tempdata/config.json')).toBe(true);
    
    // Wildcard in file pattern
    expect(engine['shouldExclude']('/path/monthly_report.md')).toBe(true);
    expect(engine['shouldExclude']('/docs/annual_report.md')).toBe(true);
    expect(engine['shouldExclude']('/folder/xcustom_stringx.txt')).toBe(true);
    
    // Non-matching paths
    expect(engine['shouldExclude']('/work/file.txt')).toBe(false);
    expect(engine['shouldExclude']('/tmp/data.json')).toBe(false);
    expect(engine['shouldExclude']('/path/notes.md')).toBe(false);
  });

  it('should handle empty exclude arrays', () => {
    const settings: Partial<SyncSettings> = {
      excludePaths: [],
      excludeFiles: [],
    };
    
    const engine = new SyncEngine(mockFs, settings as SyncSettings, []);
    
    expect(engine['shouldExclude']('/any/path/file.txt')).toBe(false);
  });

  it('should match paths both with and without trailing slashes', () => {
    const settings: Partial<SyncSettings> = {
      excludePaths: ['/exact/path/'],
      excludeFiles: [],
    };
    
    const engine = new SyncEngine(mockFs, settings as SyncSettings, []);
    
    expect(engine['shouldExclude']('/exact/path')).toBe(true);
    expect(engine['shouldExclude']('/exact/path/')).toBe(true);
    expect(engine['shouldExclude']('/exact/path/file.txt')).toBe(true);
    expect(engine['shouldExclude']('/exact/pathother')).toBe(false);
  });
  
  it('should handle undefined excludeFiles', () => {
    const settings: Partial<SyncSettings> = {
      excludePaths: ['/temp'],
      excludeFiles: undefined,
    };
    
    const engine = new SyncEngine(mockFs, settings as SyncSettings, []);
    
    expect(engine['shouldExclude']('/temp/file.txt')).toBe(true);
    expect(engine['shouldExclude']('/src/file.txt')).toBe(false);
  });
});

describe('SyncEngine - Queue - Event sorting', () => {
  const settings: Partial<SyncSettings> = {};
  const engine = new SyncEngine(mockFs, settings as SyncSettings, []);

  it('should sort events according to SORT_ORDER', async () => {
    const events: FileEvent[] = [
      { name: 'asset.png', path: '/asset.png', type: 'asset', action: 'create', timestamp: 1 },
      { name: 'doc.md', path: '/doc.md', type: 'markdown', action: 'create', timestamp: 2 },
      { name: 'unknown.txt', path: '/unknown.txt', type: 'unknown', action: 'create', timestamp: 3 },
      { name: 'meta.md', path: '/meta.md', type: 'meta', action: 'create', timestamp: 4 },
    ];

    for (const event of events) {
      engine.queueEvent(event);
    }

    // Access the eventQueue after queueing events
    const sorted = await (engine as any)['sortQueue'](engine['eventQueue']);
    
    expect(sorted.map((e: FileEvent) => e.type)).toEqual(['meta', 'markdown', 'asset', 'unknown']);
  });

  it('should sort events of the same type by timestamp', async () => {
    const events: FileEvent[] = [
      { name: 'doc3.md', path: '/doc3.md', type: 'markdown', action: 'create', timestamp: 30 },
      { name: 'doc1.md', path: '/doc1.md', type: 'markdown', action: 'create', timestamp: 10 },
      { name: 'doc2.md', path: '/doc2.md', type: 'markdown', action: 'create', timestamp: 20 },
    ];

    const sorted = await (engine as any)['sortQueue'](events);
    
    expect(sorted.filter((e: FileEvent) => e.type === 'markdown').map((e: FileEvent) => e.timestamp)).toEqual([10, 20, 30]);
  });

  it('should handle mixed types and timestamps correctly', async () => {
    const events: FileEvent[] = [
      { name: 'meta2.md', path: '/meta2.md', type: 'meta', action: 'create', timestamp: 20 },
      { name: 'asset1.png', path: '/asset1.png', type: 'asset', action: 'create', timestamp: 10 },
      { name: 'meta1.md', path: '/meta1.md', type: 'meta', action: 'create', timestamp: 10 },
      { name: 'asset2.png', path: '/asset2.png', type: 'asset', action: 'create', timestamp: 20 },
    ];

    const sorted = await (engine as any)['sortQueue'](events);
    
    // Check that events are first sorted by type (according to SORT_ORDER), then by timestamp
    expect(sorted.map((e: FileEvent) => `${e.type}-${e.timestamp}`)).toEqual([
      'meta-10', 'meta-20', 'asset-10', 'asset-20'
    ]);
  });

  it('should handle all file types in random order', async () => {
    const events: FileEvent[] = [
      { name: 'unknown2.txt', path: '/unknown2.txt', type: 'unknown', action: 'create', timestamp: 20 },
      { name: 'asset1.png', path: '/asset1.png', type: 'asset', action: 'create', timestamp: 10 },
      { name: 'meta1.md', path: '/meta1.md', type: 'meta', action: 'create', timestamp: 30 },
      { name: 'doc1.md', path: '/doc1.md', type: 'markdown', action: 'create', timestamp: 40 },
    ];

    const sorted = await (engine as any)['sortQueue'](events);
    
    expect(sorted.map((e: FileEvent) => e.type)).toEqual(['meta', 'markdown', 'asset', 'unknown']);
  });
});

describe('SyncEngine - Queue - Batch & Event processing Simulation', () => {
  let syncEngine: SyncEngine;
  let processedEvents: FileEvent[];
  
  beforeEach(() => {
    processedEvents = [];
    
    // Mock FileSystem
    const mockFs: FileSystem = {
      readFile: vi.fn(),
      writeFile: vi.fn(),
      exists: vi.fn(),
      createDirectory: vi.fn(),
      deleteFile: vi.fn(),
      moveFile: vi.fn(),
    };
    
    // Mock settings
    const settings: SyncSettings = {
      excludePaths: [],
      excludeFiles: [],
      targetBasePath: '/test',
      contentPath: '/test/content',
      assetsPath: '/test/assets',
      debug: true,
      logToDisk: false,
    };
    
    syncEngine = new SyncEngine(mockFs, settings, []);
    
    // Mock the processEvent function
    vi.spyOn({ processEvent }, 'processEvent').mockImplementation(async (events: FileEvent[]) => {
      processedEvents.push(...events);
      // Simulate processing time (shorter for tests)
      await new Promise(resolve => setTimeout(resolve, 50));
    });
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should process events in correct batch order with proper sorting', async () => {
    // Create events with different types and timestamps
    const firstBatch: FileEvent[] = [
      { 
        name: 'file3.md',
        type: 'markdown',
        path: '/path/file3.md',
        action: 'delete',
        timestamp: 3
      },
      {
        name: 'file1.md',
        type: 'markdown',
        path: '/path/file1.md',
        action: 'create',
        timestamp: 1
      },
      {
        name: 'file2.md',
        type: 'markdown',
        path: '/path/file2.md',
        action: 'modify',
        timestamp: 2
      }
    ];

    // Queue first batch
    for (const event of firstBatch) {
      syncEngine.queueEvent(event);
    }

    // Wait a bit to simulate time passing
    await new Promise(resolve => setTimeout(resolve, 150));

    // Queue second batch while first batch is processing
    const secondBatch: FileEvent[] = [
      {
        name: 'file4.md',
        type: 'markdown',
        path: '/path/file4.md',
        action: 'create',
        timestamp: 4
      },
      {
        name: 'file6',
        type: 'markdown',
        path: '/path/file6.md',
        action: 'delete',
        timestamp: 6
      },
      {
        name: 'file5.md',
        type: 'markdown',
        path: '/path/file5.md',
        action: 'modify',
        timestamp: 5
      }
    ];

    for (const event of secondBatch) {
      syncEngine.queueEvent(event);
    }

    // Wait for all processing to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Verify processing order
    expect(processedEvents.length).toBe(6);
    
    // Verify first batch was processed in correct order
    expect(processedEvents[0].path).toBe('/path/file1.md'); // create should be first
    expect(processedEvents[1].path).toBe('/path/file2.md'); // modify second
    expect(processedEvents[2].path).toBe('/path/file3'); // delete last
    
    // Verify second batch was processed after first batch
    expect(processedEvents[3].path).toBe('/path/file4.md'); // create first
    expect(processedEvents[4].path).toBe('/path/file5.md'); // modify second
    expect(processedEvents[5].path).toBe('/path/file6.md'); // delete last


  });
});

