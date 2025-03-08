// src/rules/markdown-rule.test.ts
import { describe, it, expect } from 'vitest';
import { createMarkdownRule } from '../../src/rules/markdown-rule';
import { FileEvent, SyncSettings, TransformContext } from '../../src/types';

describe('Markdown Rule', () => {
  // Default settings for testing
  const defaultSettings: SyncSettings = {
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
    logToDisk: false
  };

  // Default context for testing
  const context: TransformContext = {
    metaCache: new Map(),
    assetMap: new Map(),
    settings: defaultSettings
  };

  const rule = createMarkdownRule();

  it('should have the correct name', () => {
    expect(rule.name).toBe('Markdown Rule');
  });

  describe('shouldApply', () => {
    it('should apply to regular markdown files', () => {
      const event: FileEvent = {
        name: 'regular-note.md',
        path: '/notes/regular-note.md',
        type: 'markdown',
        action: 'create',
        timestamp: 1
      };

      expect(rule.shouldApply(event, context)).toBe(true);
    });

    it('should not apply to meta markdown files', () => {
      const event: FileEvent = {
        name: 'page_meta.md',
        path: '/notes/page_meta.md',
        type: 'markdown',
        action: 'create',
        timestamp: 1
      };

      expect(rule.shouldApply(event, context)).toBe(false);
    });

    it('should not apply to localized markdown files', () => {
      const event: FileEvent = {
        name: 'article__de.md',
        path: '/notes/article__de.md',
        type: 'markdown',
        action: 'create',
        timestamp: 1
      };

      expect(rule.shouldApply(event, context)).toBe(false);
    });

    it('should not apply to non-markdown files', () => {
      const event: FileEvent = {
        name: 'image.png',
        path: '/assets/image.png',
        type: 'asset',
        action: 'create',
        timestamp: 1
      };

      expect(rule.shouldApply(event, context)).toBe(false);
    });
  });

  describe('transform', () => {
    it('should transform paths correctly for root level files', () => {
      const result = rule.transform('/note.md', context);
      expect(result).toBe('target/content/note.md');
    });

    it('should preserve directory structure', () => {
      const result = rule.transform('/notes/blog/article.md', context);
      expect(result).toBe('target/content/notes/blog/article.md');
    });

    it('should handle paths without leading slash', () => {
      const result = rule.transform('notes/project/readme.md', context);
      expect(result).toBe('target/content/notes/project/readme.md');
    });

    it('should handle paths with multiple directory levels', () => {
      const result = rule.transform('/section1/section2/section3/document.md', context);
      expect(result).toBe('target/content/section1/section2/section3/document.md');
    });
  });
});