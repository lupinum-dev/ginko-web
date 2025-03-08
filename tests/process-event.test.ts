// src/core/process-event.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processEvent } from '../src/core/process-event';
import { FileEvent, FileSystem, Logger, Rule, SyncSettings } from '../src/types';
import { createMarkdownRule } from '../src/rules/markdown-rule';
import { createAssetRule } from '../src/rules/asset-rule';
import { createLocalizedMarkdownRule } from '../src/rules/localized-markdown-rule';


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
 * Helper to create a mock file system for testing
 */
const createMockFileSystem = (): FileSystem => ({
  readFile: vi.fn().mockResolvedValue(''),
  writeFile: vi.fn().mockResolvedValue(undefined),
  deleteFile: vi.fn().mockResolvedValue(undefined),
  moveFile: vi.fn().mockResolvedValue(undefined),
  createDirectory: vi.fn().mockResolvedValue(undefined),
  exists: vi.fn().mockResolvedValue(false)
});

/**
 * Helper to create event objects for testing
 */
const createEvent = (
  action: 'create' | 'modify' | 'delete' | 'rename',
  name: string,
  path: string,
  content?: string | null,
  oldPath?: string
): FileEvent => ({
  name,
  path,
  type: path.endsWith('.md') 
    ? 'markdown' 
    : path.endsWith('.png') || path.endsWith('.jpg') 
      ? 'asset' 
      : 'unknown',
  action,
  oldPath,
  content: content !== null ? content : undefined,
  timestamp: Date.now()
});

describe('processEvent with Rules', () => {
  let mockFs: FileSystem;
  let mockLogger: Logger;
  let defaultSettings: SyncSettings;
  let rules: Rule[];

  beforeEach(() => {
    mockFs = createMockFileSystem();
    mockLogger = createMockLogger();
    
    // Default settings for testing
    defaultSettings = {
      obsidianRoot: '/obsidian',
      targetBasePathUser: './target',
      targetBasePath: './target',
      contentPathUser: 'content',
      contentPath: 'content',
      assetsPathUser: 'public/assets',
      assetsPath: 'public/assets',
      excludePaths: [],
      excludeFiles: [],
      debug: false,
      logToDisk: false,
      logFilePath: '.obsidian/plugins/ginko'
    };
    
    // Create rules for testing
    rules = [
      createLocalizedMarkdownRule(),
      createMarkdownRule(),
      createAssetRule()
    ];
    
    // Mock exists to return true for specific paths to test different scenarios
    vi.mocked(mockFs.exists).mockImplementation(async (path: string) => {
      if (path.includes('existing')) return true;
      if (path.includes('/target/content')) return true;
      if (path.includes('/target/public/assets')) return true;
      if (path.includes('directory')) return true;
      return false;
    });
  });

  describe('Rule Application', () => {
    it('should apply the correct rule for markdown files', async () => {
      // Arrange
      const event = createEvent('create', 'note.md', '/notes/note.md', 'Test content');
      vi.mocked(mockFs.readFile).mockResolvedValue('Test content');
      
      // Act
      await processEvent(event, defaultSettings, rules, mockLogger, mockFs);
      
      // Assert
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        './target/content/notes/note.md', 
        'Test content'
      );
      
      // Log the actual calls for debugging
      console.log('writeFile calls:', vi.mocked(mockFs.writeFile).mock.calls);
    });

    it('should apply the correct rule for localized markdown files', async () => {
      // Arrange
      const event = createEvent('create', 'note__de.md', '/notes/note__de.md', 'German content');
      
      // Act
      await processEvent(event, defaultSettings, rules, mockLogger, mockFs);
      
      // Assert
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        './target/content/de/notes/note.md', 
        'German content'
      );
      
      // Log the actual calls for debugging
      console.log('writeFile calls:', vi.mocked(mockFs.writeFile).mock.calls);
    });

    it('should apply the correct rule for asset files', async () => {
      // Arrange
      const event = createEvent('create', 'image.png', '/assets/image.png', null);
      vi.mocked(mockFs.readFile).mockResolvedValue('binary content');
      
      // Act
      await processEvent(event, defaultSettings, rules, mockLogger, mockFs);
      
      // Assert
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        './target/public/assets/image.png', 
        'binary content'
      );
      
      // Log the actual calls for debugging
      console.log('writeFile calls:', vi.mocked(mockFs.writeFile).mock.calls);
    });

    it('should use default path when no rule matches', async () => {
      // Arrange
      const event = createEvent('create', 'unknown.xyz', '/misc/unknown.xyz', 'Unknown content');
      
      // Act
      await processEvent(event, defaultSettings, rules, mockLogger, mockFs);
      
      // Assert
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        './target/misc/unknown.xyz', 
        'Unknown content'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'sync-engine',
        expect.stringContaining('No matching rule')
      );
      
      // Log the actual calls for debugging
      console.log('writeFile calls:', vi.mocked(mockFs.writeFile).mock.calls);
    });
  });

  describe('Event Types', () => {
    it('should handle create events properly', async () => {
      // Arrange
      const event = createEvent('create', 'new.md', '/notes/new.md', 'New content');
      
      // Act
      await processEvent(event, defaultSettings, rules, mockLogger, mockFs);
      
      // Assert
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        './target/content/notes/new.md', 
        'New content'
      );
      
      // Log the actual calls for debugging
      console.log('writeFile calls:', vi.mocked(mockFs.writeFile).mock.calls);
    });

    it('should handle delete events properly', async () => {
      // Arrange
      const event = createEvent('delete', 'existing.md', '/notes/existing.md');
      vi.mocked(mockFs.exists).mockResolvedValueOnce(true);
      
      // Act
      await processEvent(event, defaultSettings, rules, mockLogger, mockFs);
      
      // Assert
      expect(mockFs.deleteFile).toHaveBeenCalledWith('./target/content/notes/existing.md');
      
      // Log the actual calls for debugging
      console.log('deleteFile calls:', vi.mocked(mockFs.deleteFile).mock.calls);
    });

    it('should handle rename events properly', async () => {
      // Arrange
      const event = createEvent(
        'rename', 
        'new-name.md', 
        '/notes/new-name.md', 
        'Content', 
        '/notes/old-name.md'
      );
      vi.mocked(mockFs.exists).mockResolvedValueOnce(true);
      
      // Act
      await processEvent(event, defaultSettings, rules, mockLogger, mockFs);
      
      // Assert
      expect(mockFs.moveFile).toHaveBeenCalledWith(
        './target/content/notes/old-name.md',
        './target/content/notes/new-name.md'
      );
      
      // Log the actual calls for debugging
      console.log('moveFile calls:', vi.mocked(mockFs.moveFile).mock.calls);
    });

    it('should handle modify events properly', async () => {
      // Arrange
      const event = createEvent('modify', 'existing.md', '/notes/existing.md', 'Updated content');
      vi.mocked(mockFs.exists).mockResolvedValueOnce(true);
      
      // Act
      await processEvent(event, defaultSettings, rules, mockLogger, mockFs);
      
      // Assert
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        './target/content/notes/existing.md',
        'Updated content'
      );
      
      // Log the actual calls for debugging
      console.log('writeFile calls:', vi.mocked(mockFs.writeFile).mock.calls);
    });
  });

  describe('Special Cases', () => {
    it('should create parent directories if they do not exist', async () => {
      // Arrange
      const event = createEvent(
        'create', 
        'deep.md', 
        '/very/deep/structure/deep.md', 
        'Deep content'
      );
      vi.mocked(mockFs.exists).mockResolvedValue(false);
      
      // Act
      await processEvent(event, defaultSettings, rules, mockLogger, mockFs);
      
      // Assert
      expect(mockFs.createDirectory).toHaveBeenCalled();
      expect(mockFs.writeFile).toHaveBeenCalled();
      
      // Log the actual calls for debugging
      console.log('createDirectory calls:', vi.mocked(mockFs.createDirectory).mock.calls);
      console.log('writeFile calls:', vi.mocked(mockFs.writeFile).mock.calls);
    });

    it('should handle rename when source file does not exist', async () => {
      // Arrange
      const event = createEvent(
        'rename', 
        'new.md', 
        '/notes/new.md', 
        'Content', 
        '/notes/nonexistent.md'
      );
      vi.mocked(mockFs.exists).mockResolvedValueOnce(false);
      
      // Act
      await processEvent(event, defaultSettings, rules, mockLogger, mockFs);
      
      // Assert
      expect(mockFs.moveFile).not.toHaveBeenCalled();
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        './target/content/notes/new.md',
        'Content'
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'sync-engine',
        expect.stringContaining('Source file for rename doesn\'t exist')
      );
      
      // Log the actual calls for debugging
      console.log('writeFile calls:', vi.mocked(mockFs.writeFile).mock.calls);
    });

    it('should handle modify when target file does not exist', async () => {
      // Arrange
      const event = createEvent(
        'modify', 
        'nonexistent.md', 
        '/notes/nonexistent.md', 
        'Content'
      );
      vi.mocked(mockFs.exists).mockResolvedValueOnce(false);
      
      // Act
      await processEvent(event, defaultSettings, rules, mockLogger, mockFs);
      
      // Assert
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        './target/content/notes/nonexistent.md',
        'Content'
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'sync-engine',
        expect.stringContaining('Target file for modification doesn\'t exist')
      );
      
      // Log the actual calls for debugging
      console.log('writeFile calls:', vi.mocked(mockFs.writeFile).mock.calls);
    });

    it('should skip delete when target file does not exist', async () => {
      // Arrange
      const event = createEvent('delete', 'nonexistent.md', '/notes/nonexistent.md');
      vi.mocked(mockFs.exists).mockResolvedValueOnce(false);
      
      // Act
      await processEvent(event, defaultSettings, rules, mockLogger, mockFs);
      
      // Assert
      expect(mockFs.deleteFile).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'sync-engine',
        expect.stringContaining('File to delete doesn\'t exist in target')
      );
    });

    it('should handle rename across different rule categories', async () => {
      // Arrange - rename from regular markdown to localized markdown
      const event = createEvent(
        'rename', 
        'article__de.md', 
        '/notes/article__de.md', 
        'German content', 
        '/notes/article.md'
      );
      vi.mocked(mockFs.exists).mockResolvedValueOnce(true);
      
      // Act
      await processEvent(event, defaultSettings, rules, mockLogger, mockFs);
      
      // Assert - source and target paths should use different rules
      expect(mockFs.moveFile).toHaveBeenCalledWith(
        './target/content/notes/article.md',
        './target/content/de/notes/article.md'
      );
      
      // Log the actual calls for debugging
      console.log('moveFile calls:', vi.mocked(mockFs.moveFile).mock.calls);
    });
  });

  describe('Error Handling', () => {
    it('should throw an error for rename event without oldPath', async () => {
      // Arrange
      const event = {
        name: 'broken.md',
        path: '/notes/broken.md',
        type: 'markdown' as const,
        action: 'rename' as const,
        timestamp: Date.now()
        // No oldPath provided
      };
      
      // Act & Assert
      await expect(processEvent(
        event, 
        defaultSettings, 
        rules, 
        mockLogger, 
        mockFs
      )).rejects.toThrow('Rename event missing oldPath');
    });

    it('should handle errors when reading source files', async () => {
      // Arrange
      const event = createEvent('create', 'error.md', '/notes/error.md');
      vi.mocked(mockFs.readFile).mockRejectedValueOnce(new Error('Read error'));
      
      // Act & Assert
      await expect(processEvent(
        event, 
        defaultSettings, 
        rules, 
        mockLogger, 
        mockFs
      )).rejects.toThrow('Read error');
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        'sync-engine',
        expect.stringContaining('Failed to read source file for creation')
      );
    });

    it('should handle errors when writing files', async () => {
      // Arrange
      const event = createEvent('create', 'error.md', '/notes/error.md', 'Content');
      vi.mocked(mockFs.writeFile).mockRejectedValueOnce(new Error('Write error'));
      
      // Act & Assert
      await expect(processEvent(
        event, 
        defaultSettings, 
        rules, 
        mockLogger, 
        mockFs
      )).rejects.toThrow('Write error');
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        'sync-engine',
        expect.stringContaining('Error handling create event')
      );
    });
  });
});