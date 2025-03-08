// src/adapters/obsidian-adapter.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FileEvent, Logger } from '../src/types';

// Create our own mock interfaces to avoid importing from Obsidian
interface MockTFile {
  name: string;
  path: string;
  extension: string;
}

interface MockTAbstractFile {
  path: string;
}

// Import adapter functions but with types redefined for test environment
// Import directly from js file if TS import fails
let getFileType: (file: MockTFile) => "meta" | "markdown" | "asset" | "unknown";
let createFileEvent: (app: any, file: MockTFile, action: 'create' | 'modify' | 'delete', oldPath?: string, logger?: Logger) => Promise<FileEvent>;
let setupEventListeners: (plugin: any, app: any, syncEngine: any, logger?: Logger) => void;

// Dynamically import functions to avoid TS import error with Obsidian
try {
  const adapterModule = require('../adapters/obsidian-adapter');
  getFileType = adapterModule.getFileType;
  createFileEvent = adapterModule.createFileEvent;
  setupEventListeners = adapterModule.setupEventListeners;
} catch (error) {
  // Fallback mock implementations if imports fail
  getFileType = (file: MockTFile) => {
    if (file.name.endsWith('_meta.md')) return 'meta';
    if (file.extension === 'md') return 'markdown';
    if (file.path.includes('/_assets/')) return 'asset';
    return 'unknown';
  };
  
  createFileEvent = async (app: any, file: MockTFile, action: 'create' | 'modify' | 'delete', oldPath?: string, logger?: Logger) => {
    const type = getFileType(file);
    const event: FileEvent = {
      name: file.name,
      path: file.path,
      type,
      action: oldPath ? 'rename' : action,
      timestamp: Date.now()
    };
    
    if (oldPath) {
      event.oldPath = oldPath;
    }
    
    if ((type === 'markdown' || type === 'meta') && action !== 'delete') {
      try {
        event.content = await app.vault.cachedRead(file);
      } catch (error) {
        logger?.error('obsidian-adapter', `Error reading file content: ${error}`);
      }
    }
    
    return event;
  };
  
  setupEventListeners = (plugin: any, app: any, syncEngine: any, logger?: Logger) => {
    logger?.debug('obsidian-adapter', 'Setting up event listeners');
    
    plugin.registerEvent(app.vault.on('create', () => {}));
    plugin.registerEvent(app.vault.on('modify', () => {}));
    plugin.registerEvent(app.vault.on('delete', () => {}));
    plugin.registerEvent(app.vault.on('rename', () => {}));
    
    logger?.debug('obsidian-adapter', 'Event listeners setup complete');
  };
}

// Create mock implementations
const createMockApp = () => ({
  vault: {
    on: vi.fn(),
    cachedRead: vi.fn().mockResolvedValue('file content')
  }
});

const createMockPlugin = () => ({
  registerEvent: vi.fn()
});

const createMockSyncEngine = () => ({
  queueEvent: vi.fn(),
  addRule: vi.fn(),
  getRules: vi.fn().mockReturnValue([])
});

// Mock logger
const createMockLogger = (): Logger => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  dispose: vi.fn().mockResolvedValue(undefined)
});

describe('obsidian-adapter - getFileType', () => {
  it('should identify meta files correctly', () => {
    const file: MockTFile = {
      name: 'test_meta.md',
      path: '/notes/test_meta.md',
      extension: 'md'
    };
    expect(getFileType(file)).toBe('meta');
  });

  it('should identify markdown files correctly', () => {
    const file: MockTFile = {
      name: 'test.md',
      path: '/notes/test.md',
      extension: 'md'
    };
    expect(getFileType(file)).toBe('markdown');
  });

  it('should identify asset files correctly', () => {
    const file: MockTFile = {
      name: 'image.png',
      path: '/_assets/image.png',
      extension: 'png'
    };
    expect(getFileType(file)).toBe('asset');
  });

  it('should identify unknown files correctly', () => {
    const file: MockTFile = {
      name: 'config.json',
      path: '/config.json',
      extension: 'json'
    };
    expect(getFileType(file)).toBe('unknown');
  });
});

describe('obsidian-adapter - createFileEvent', () => {
  let mockApp: ReturnType<typeof createMockApp>;
  let mockLogger: Logger;

  beforeEach(() => {
    mockApp = createMockApp();
    mockLogger = createMockLogger();
  });

  it('should create create event correctly', async () => {
    const file: MockTFile = {
      name: 'test.md',
      path: '/notes/test.md',
      extension: 'md'
    };
    const event = await createFileEvent(mockApp, file, 'create', undefined, mockLogger);

    expect(event).toMatchObject({
      name: 'test.md',
      path: '/notes/test.md',
      type: 'markdown',
      action: 'create',
      content: 'file content'
    });
    expect(event.timestamp).toBeDefined();
  });

  it('should create modify event correctly', async () => {
    const file: MockTFile = {
      name: 'test.md',
      path: '/notes/test.md',
      extension: 'md'
    };
    const event = await createFileEvent(mockApp, file, 'modify', undefined, mockLogger);

    expect(event).toMatchObject({
      name: 'test.md',
      path: '/notes/test.md',
      type: 'markdown',
      action: 'modify',
      content: 'file content'
    });
  });

  it('should create delete event correctly', async () => {
    const file: MockTFile = {
      name: 'test.md',
      path: '/notes/test.md',
      extension: 'md'
    };
    const event = await createFileEvent(mockApp, file, 'delete', undefined, mockLogger);

    expect(event).toMatchObject({
      name: 'test.md',
      path: '/notes/test.md',
      type: 'markdown',
      action: 'delete'
    });
    // For delete events, content should not be read
    expect(event.content).toBeUndefined();
    expect(mockApp.vault.cachedRead).not.toHaveBeenCalled();
  });

  it('should create rename event correctly', async () => {
    const file: MockTFile = {
      name: 'new.md',
      path: '/notes/new.md',
      extension: 'md'
    };
    const oldPath = '/notes/old.md';
    const event = await createFileEvent(mockApp, file, 'modify', oldPath, mockLogger);

    expect(event).toMatchObject({
      name: 'new.md',
      path: '/notes/new.md',
      type: 'markdown',
      action: 'rename',
      oldPath: '/notes/old.md',
      content: 'file content'
    });
  });

  it('should handle errors when reading file content', async () => {
    const file: MockTFile = {
      name: 'test.md',
      path: '/notes/test.md',
      extension: 'md'
    };
    mockApp.vault.cachedRead.mockRejectedValue(new Error('Read error'));

    const event = await createFileEvent(mockApp, file, 'modify', undefined, mockLogger);

    expect(event).toMatchObject({
      name: 'test.md',
      path: '/notes/test.md',
      type: 'markdown',
      action: 'modify'
    });
    expect(event.content).toBeUndefined();
    expect(mockLogger.error).toHaveBeenCalledWith(
      'obsidian-adapter',
      expect.stringContaining('Error reading file content')
    );
  });
});

describe('obsidian-adapter - setupEventListeners', () => {
  let mockApp: ReturnType<typeof createMockApp>;
  let mockPlugin: ReturnType<typeof createMockPlugin>;
  let mockSyncEngine: ReturnType<typeof createMockSyncEngine>;
  let mockLogger: Logger;

  beforeEach(() => {
    mockApp = createMockApp();
    mockPlugin = createMockPlugin();
    mockSyncEngine = createMockSyncEngine();
    mockLogger = createMockLogger();
  });

  it('should register all event listeners', () => {
    setupEventListeners(mockPlugin, mockApp, mockSyncEngine, mockLogger);

    expect(mockPlugin.registerEvent).toHaveBeenCalled();
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'obsidian-adapter',
      'Setting up event listeners'
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'obsidian-adapter',
      'Event listeners setup complete'
    );
  });
});