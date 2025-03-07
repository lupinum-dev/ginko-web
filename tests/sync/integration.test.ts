// tests/sync/integration.test.ts
import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import { SyncManager } from '../../src/core/sync-manager';
import { MockFileSystem } from '../mock-filesystem';
import { SyncEvent, SyncSettings } from '../../src/types';
import path from 'path';

/**
 * Integration tests for SyncManager
 * 
 * These tests simulate a complete Obsidian vault sync operation with multiple files,
 * different types, and complex scenarios to ensure all components work together correctly.
 */
describe('SyncManager Integration Tests', () => {
  let syncManager: SyncManager;
  let mockFs: MockFileSystem;
  let settings: SyncSettings;
  
  // Helper method to directly call processQueue on the SyncManager
  async function forceProcessQueue(manager: SyncManager): Promise<void> {
    await (manager as any).processQueue();
  }
  
  beforeEach(() => {
    // Use real timers
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

  // Helper function to create events
  function createEvent(
    name: string, 
    path: string, 
    type: 'markdown' | 'meta' | 'asset' | 'unknown', 
    action: 'create' | 'modify' | 'delete' | 'rename',
    content?: string,
    oldPath?: string
  ): SyncEvent {
    return {
      name,
      path,
      type,
      action,
      content,
      oldPath,
      timestamp: Date.now()
    };
  }

  // Helper to process events and wait for completion
  async function processEvents(events: SyncEvent[]): Promise<void> {
    for (const event of events) {
      await syncManager.queueEvent(event);
    }
    await forceProcessQueue(syncManager);
  }
  
  test('should sync a complete vault structure', async () => {
    // Create a mock vault structure with folders, files, assets, and language-specific content
    const events: SyncEvent[] = [
      // Create folder structure with meta files
      createEvent('_meta.md', '/vault/_meta.md', 'meta', 'create', 
        '---\ntitle: Root Folder\ndescription: Main vault\n---\n'),
      
      createEvent('_meta.md', '/vault/blog/_meta.md', 'meta', 'create', 
        '---\ntitle: Blog\ndescription: Blog posts\n---\n'),
      
      createEvent('_meta.md', '/vault/notes/_meta.md', 'meta', 'create', 
        '---\ntitle: Notes\ndescription: Personal notes\n---\n'),
      
      // Regular markdown files
      createEvent('welcome.md', '/vault/welcome.md', 'markdown', 'create', 
        '# Welcome\nThis is the main page'),
      
      createEvent('post1.md', '/vault/blog/post1.md', 'markdown', 'create', 
        '# Post 1\nThis is a blog post'),
      
      createEvent('post2.md', '/vault/blog/post2.md', 'markdown', 'create', 
        '# Post 2\nThis is another blog post'),
      
      // Language-specific files
      createEvent('about__en.md', '/vault/about__en.md', 'markdown', 'create', 
        '# About\nThis is the English about page'),
      
      createEvent('about__de.md', '/vault/about__de.md', 'markdown', 'create', 
        '# Über uns\nDies ist die deutsche Über-uns-Seite'),
      
      createEvent('post1__en.md', '/vault/blog/post1__en.md', 'markdown', 'create', 
        '# Post 1\nThis is the English version'),
      
      createEvent('post1__de.md', '/vault/blog/post1__de.md', 'markdown', 'create', 
        '# Beitrag 1\nDies ist die deutsche Version'),
      
      // Asset files
      createEvent('logo.png', '/vault/_assets/logo.png', 'asset', 'create', 
        'binary-logo-content'),
      
      createEvent('image1.jpg', '/vault/blog/_assets/image1.jpg', 'asset', 'create', 
        'binary-image1-content')
    ];
    
    await processEvents(events);
    
    // Verify the structure was created correctly
    
    // Check meta files
    expect(mockFs.hasFile('/target/content/vault/_meta.md')).toBe(true);
    expect(mockFs.hasFile('/target/content/vault/blog/_meta.md')).toBe(true);
    expect(mockFs.hasFile('/target/content/vault/notes/_meta.md')).toBe(true);
    
    // Check regular markdown files
    expect(mockFs.hasFile('/target/content/vault/welcome.md')).toBe(true);
    expect(mockFs.hasFile('/target/content/vault/blog/post1.md')).toBe(true);
    expect(mockFs.hasFile('/target/content/vault/blog/post2.md')).toBe(true);
    
    // Check language-specific files
    expect(mockFs.hasFile('/target/content/en/vault/about.md')).toBe(true);
    expect(mockFs.hasFile('/target/content/de/vault/about.md')).toBe(true);
    expect(mockFs.hasFile('/target/content/en/vault/blog/post1.md')).toBe(true);
    expect(mockFs.hasFile('/target/content/de/vault/blog/post1.md')).toBe(true);
    
    // Check asset files (these should go through the generic rule)
    expect(mockFs.hasFile('/target/content/vault/_assets/logo.png')).toBe(true);
    expect(mockFs.hasFile('/target/content/vault/blog/_assets/image1.jpg')).toBe(true);
    
    // Verify file contents
    expect(mockFs.getFileContent('/target/content/en/vault/about.md')).toBe('# About\nThis is the English about page');
    expect(mockFs.getFileContent('/target/content/de/vault/about.md')).toBe('# Über uns\nDies ist die deutsche Über-uns-Seite');
  });
  
  test('should handle file updates, deletes and renames in batch processing', async () => {
    // Initial setup
    const setupEvents: SyncEvent[] = [
      createEvent('file1.md', '/vault/file1.md', 'markdown', 'create', 'Content 1'),
      createEvent('file2.md', '/vault/file2.md', 'markdown', 'create', 'Content 2'),
      createEvent('file3.md', '/vault/file3.md', 'markdown', 'create', 'Content 3'),
      createEvent('post__en.md', '/vault/post__en.md', 'markdown', 'create', 'English post'),
      createEvent('post__de.md', '/vault/post__de.md', 'markdown', 'create', 'German post')
    ];
    
    await processEvents(setupEvents);
    
    // Verify initial setup
    expect(mockFs.hasFile('/target/content/vault/file1.md')).toBe(true);
    expect(mockFs.hasFile('/target/content/vault/file2.md')).toBe(true);
    expect(mockFs.hasFile('/target/content/vault/file3.md')).toBe(true);
    expect(mockFs.hasFile('/target/content/en/vault/post.md')).toBe(true);
    expect(mockFs.hasFile('/target/content/de/vault/post.md')).toBe(true);
    
    // Now create a batch of mixed events
    const changesEvents: SyncEvent[] = [
      // Update a file
      createEvent('file1.md', '/vault/file1.md', 'markdown', 'modify', 'Updated content 1'),
      
      // Delete a file
      createEvent('file2.md', '/vault/file2.md', 'markdown', 'delete'),
      
      // Rename a file
      createEvent('file3-renamed.md', '/vault/file3-renamed.md', 'markdown', 'rename', 'Content 3', '/vault/file3.md'),
      
      // Update a language file
      createEvent('post__en.md', '/vault/post__en.md', 'markdown', 'modify', 'Updated English post'),
      
      // Create a new file
      createEvent('file4.md', '/vault/file4.md', 'markdown', 'create', 'Content 4')
    ];
    
    await processEvents(changesEvents);
    
    // Verify the changes were applied correctly
    
    // Updated file
    expect(mockFs.getFileContent('/target/content/vault/file1.md')).toBe('Updated content 1');
    
    // Deleted file
    expect(mockFs.hasFile('/target/content/vault/file2.md')).toBe(false);
    
    // Renamed file
    expect(mockFs.hasFile('/target/content/vault/file3.md')).toBe(false);
    expect(mockFs.hasFile('/target/content/vault/file3-renamed.md')).toBe(true);
    
    // Updated language file
    expect(mockFs.getFileContent('/target/content/en/vault/post.md')).toBe('Updated English post');
    
    // New file
    expect(mockFs.hasFile('/target/content/vault/file4.md')).toBe(true);
    expect(mockFs.getFileContent('/target/content/vault/file4.md')).toBe('Content 4');
  });
  
  test('should handle complex folder structures and nested paths', async () => {
    // Create a complex nested structure
    const events: SyncEvent[] = [
      // Meta files at different levels
      createEvent('_meta.md', '/vault/_meta.md', 'meta', 'create', 
        '---\ntitle: Root\n---'),
      
      createEvent('_meta.md', '/vault/level1/_meta.md', 'meta', 'create', 
        '---\ntitle: Level 1\n---'),
      
      createEvent('_meta.md', '/vault/level1/level2/_meta.md', 'meta', 'create', 
        '---\ntitle: Level 2\n---'),
      
      createEvent('_meta.md', '/vault/level1/level2/level3/_meta.md', 'meta', 'create', 
        '---\ntitle: Level 3\n---'),
      
      // Regular files at different levels
      createEvent('root.md', '/vault/root.md', 'markdown', 'create', 'Root content'),
      createEvent('level1.md', '/vault/level1/level1.md', 'markdown', 'create', 'Level 1 content'),
      createEvent('level2.md', '/vault/level1/level2/level2.md', 'markdown', 'create', 'Level 2 content'),
      createEvent('level3.md', '/vault/level1/level2/level3/level3.md', 'markdown', 'create', 'Level 3 content'),
      
      // Language files at different levels
      createEvent('lang__en.md', '/vault/lang__en.md', 'markdown', 'create', 'English root'),
      createEvent('lang__de.md', '/vault/lang__de.md', 'markdown', 'create', 'German root'),
      createEvent('nested__en.md', '/vault/level1/level2/nested__en.md', 'markdown', 'create', 'English nested'),
      createEvent('nested__de.md', '/vault/level1/level2/nested__de.md', 'markdown', 'create', 'German nested'),
      
      // Assets at different levels
      createEvent('root-img.png', '/vault/_assets/root-img.png', 'asset', 'create', 'root image'),
      createEvent('nested-img.png', '/vault/level1/level2/_assets/nested-img.png', 'asset', 'create', 'nested image')
    ];
    
    await processEvents(events);
    
    // Verify the structure
    
    // Meta files
    expect(mockFs.hasFile('/target/content/vault/_meta.md')).toBe(true);
    expect(mockFs.hasFile('/target/content/vault/level1/_meta.md')).toBe(true);
    expect(mockFs.hasFile('/target/content/vault/level1/level2/_meta.md')).toBe(true);
    expect(mockFs.hasFile('/target/content/vault/level1/level2/level3/_meta.md')).toBe(true);
    
    // Regular markdown files
    expect(mockFs.hasFile('/target/content/vault/root.md')).toBe(true);
    expect(mockFs.hasFile('/target/content/vault/level1/level1.md')).toBe(true);
    expect(mockFs.hasFile('/target/content/vault/level1/level2/level2.md')).toBe(true);
    expect(mockFs.hasFile('/target/content/vault/level1/level2/level3/level3.md')).toBe(true);
    
    // Language files
    expect(mockFs.hasFile('/target/content/en/vault/lang.md')).toBe(true);
    expect(mockFs.hasFile('/target/content/de/vault/lang.md')).toBe(true);
    expect(mockFs.hasFile('/target/content/en/vault/level1/level2/nested.md')).toBe(true);
    expect(mockFs.hasFile('/target/content/de/vault/level1/level2/nested.md')).toBe(true);
    
    // Asset files
    expect(mockFs.hasFile('/target/content/vault/_assets/root-img.png')).toBe(true);
    expect(mockFs.hasFile('/target/content/vault/level1/level2/_assets/nested-img.png')).toBe(true);
  });
  
  test('should handle renames with language-specific files correctly', async () => {
    // Create language files
    const setupEvents: SyncEvent[] = [
      createEvent('doc__en.md', '/vault/doc__en.md', 'markdown', 'create', 'English content'),
      createEvent('doc__de.md', '/vault/doc__de.md', 'markdown', 'create', 'German content')
    ];
    
    await processEvents(setupEvents);
    
    // Verify initial files
    expect(mockFs.hasFile('/target/content/en/vault/doc.md')).toBe(true);
    expect(mockFs.hasFile('/target/content/de/vault/doc.md')).toBe(true);
    
    // Rename both files
    const renameEvents: SyncEvent[] = [
      createEvent('renamed__en.md', '/vault/renamed__en.md', 'markdown', 'rename', 
        'English content', '/vault/doc__en.md'),
      
      createEvent('renamed__de.md', '/vault/renamed__de.md', 'markdown', 'rename', 
        'German content', '/vault/doc__de.md')
    ];
    
    await processEvents(renameEvents);
    
    // Verify the renamed files - note: in our current implementation, rename 
    // updates in-place rather than deleting and recreating
    expect(mockFs.hasFile('/target/content/en/vault/renamed.md')).toBe(true);
    expect(mockFs.hasFile('/target/content/de/vault/renamed.md')).toBe(true);
    
    // Verify content is preserved
    expect(mockFs.getFileContent('/target/content/en/vault/renamed.md')).toBe('English content');
    expect(mockFs.getFileContent('/target/content/de/vault/renamed.md')).toBe('German content');
  });
  
  test('should respect settings updates', async () => {
    // Create initial files
    const setupEvents: SyncEvent[] = [
      createEvent('file.md', '/vault/file.md', 'markdown', 'create', 'Content'),
      createEvent('page__en.md', '/vault/page__en.md', 'markdown', 'create', 'English page')
    ];
    
    await processEvents(setupEvents);
    
    // Verify initial paths
    expect(mockFs.hasFile('/target/content/vault/file.md')).toBe(true);
    expect(mockFs.hasFile('/target/content/en/vault/page.md')).toBe(true);
    
    // Update settings
    syncManager.updateSettings({
      targetBasePath: '/new-target',
      contentPath: 'new-content',
      assetsPath: 'new-assets'
    });
    
    // Create new files after settings update
    const newEvents: SyncEvent[] = [
      createEvent('new-file.md', '/vault/new-file.md', 'markdown', 'create', 'New content'),
      createEvent('new-page__en.md', '/vault/new-page__en.md', 'markdown', 'create', 'New English page')
    ];
    
    await processEvents(newEvents);
    
    // Verify files are created with new settings
    expect(mockFs.hasFile('/new-target/new-content/vault/new-file.md')).toBe(true);
    expect(mockFs.hasFile('/new-target/new-content/en/vault/new-page.md')).toBe(true);
  });
});