// tests/integration.test.ts
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SyncManager } from '../src/core/sync-manager';
import { MockFileSystem } from './mock-filesystem';
import { SyncEvent } from '../src/types';

// Sample data based on the JSON file provided
const sampleEvents: SyncEvent[] = [
  {
    name: 'aa1.png',
    path: 'AA/_assets/aa1.png',
    type: 'asset',
    action: 'create',
    timestamp: 1741372527051
  },
  {
    name: 'aa2.png',
    path: 'AA/_assets/aa2.png',
    type: 'asset',
    action: 'create',
    timestamp: 1741372527051
  },
  {
    name: '_meta.md',
    path: 'Z/X/_meta.md',
    type: 'meta',
    action: 'create',
    content: '---\nslug__en: english\nslug__de: deutsch\ngroup: true\n---\n',
    timestamp: 1741372527052
  },
  {
    name: '_meta.md',
    path: 'AA/B/_meta.md',
    type: 'meta',
    action: 'create',
    content: '---\nslug: test\ngroup: true\n---\n',
    timestamp: 1741372527052
  },
  {
    name: 'n1.md',
    path: 'AA/n1.md',
    type: 'markdown',
    action: 'create',
    content: '# Note 1\n\nThis is a test note with some embedded images.\n![](AA/_assets/aa1.png)\n![](AA/B/_assets/aa3.png)',
    timestamp: 1741372527037
  },
  {
    name: 'n1-deutsch__de.md',
    path: 'Z/N1+/n1-deutsch__de.md',
    type: 'markdown',
    action: 'create',
    content: 'Deutsch Content here\n![](AA/_assets/aa1.png)![](Z/X/_assets/x1.png)',
    timestamp: 1741372527051
  }
];

describe('Integration: SyncManager with sample data', () => {
  let syncManager: SyncManager;
  let mockFs: MockFileSystem;
  
  beforeEach(() => {
    vi.useFakeTimers();
    mockFs = new MockFileSystem();
    syncManager = new SyncManager({ debugMode: true }, mockFs);
  });
  
  afterEach(() => {
    vi.useRealTimers();
  });
  
  it('should process a batch of events correctly', async () => {
    // Queue all events
    for (const event of sampleEvents) {
      await syncManager.queueEvent(event);
    }
    
    // Advance timers to process queue
    await vi.runAllTimersAsync();
    
    // Check the file system state
    const files = mockFs.getFiles();
    
    // Check expected paths
    expect(files.has('target/AA/_assets/aa1.png')).toBe(true);
    expect(files.has('target/AA/_assets/aa2.png')).toBe(true);
    expect(files.has('target/Z/X/_meta.md')).toBe(true);
    expect(files.has('target/AA/B/_meta.md')).toBe(true);
    expect(files.has('target/AA/n1.md')).toBe(true);
    expect(files.has('target/Z/N1+/n1-deutsch__de.md')).toBe(true);
    
    // Check content of a specific file
    expect(files.get('target/AA/n1.md')?.content).toBe(
      '# Note 1\n\nThis is a test note with some embedded images.\n![](AA/_assets/aa1.png)\n![](AA/B/_assets/aa3.png)'
    );
  });
  
  it('should handle a complex sequence of operations', async () => {
    // 1. Create files
    for (const event of sampleEvents) {
      await syncManager.queueEvent(event);
    }
    await vi.runAllTimersAsync();
    
    // 2. Modify one file
    await syncManager.queueEvent({
      name: 'n1.md',
      path: 'AA/n1.md',
      type: 'markdown',
      action: 'modify',
      content: '# Modified Note 1\n\nContent has been updated',
      timestamp: 1741372527100
    });
    await vi.runAllTimersAsync();
    
    // 3. Delete one file
    await syncManager.queueEvent({
      name: 'aa2.png',
      path: 'AA/_assets/aa2.png',
      type: 'asset',
      action: 'delete',
      timestamp: 1741372527200
    });
    await vi.runAllTimersAsync();
    
    // 4. Rename one file
    await syncManager.queueEvent({
      name: 'n1-renamed.md',
      path: 'AA/n1-renamed.md',
      type: 'markdown',
      action: 'rename',
      oldPath: 'AA/n1.md',
      timestamp: 1741372527300
    });
    await vi.runAllTimersAsync();
    
    // Check final state
    const files = mockFs.getFiles();
    
    // Verify operations
    expect(files.has('target/AA/_assets/aa1.png')).toBe(true);
    expect(files.has('target/AA/_assets/aa2.png')).toBe(false); // Deleted
    expect(files.has('target/AA/n1.md')).toBe(false); // Renamed
    expect(files.has('target/AA/n1-renamed.md')).toBe(true); // New name
    
    // Check content of renamed file
    expect(files.get('target/AA/n1-renamed.md')?.content).toBe(
      '# Modified Note 1\n\nContent has been updated'
    );
  });
});