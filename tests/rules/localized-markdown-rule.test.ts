// src/rules/localized-markdown-rule.test.ts
import { describe, it, expect } from 'vitest';
import { createLocalizedMarkdownRule, createLanguageSpecificRule } from '../../src/rules/localized-markdown-rule';
import { FileEvent, SyncSettings, TransformContext } from '../../src/types';

describe('Localized Markdown Rules', () => {
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

  describe('Generic Localized Markdown Rule', () => {
    const rule = createLocalizedMarkdownRule();

    it('should have the correct name', () => {
      expect(rule.name).toBe('Localized Markdown Rule');
    });

    describe('shouldApply', () => {
      it('should apply to markdown files with language suffix', () => {
        const event: FileEvent = {
          name: 'article__de.md',
          path: '/notes/article__de.md',
          type: 'markdown',
          action: 'create',
          timestamp: 1
        };

        expect(rule.shouldApply(event, context)).toBe(true);
      });

      it('should apply to markdown files with other language suffixes', () => {
        const event: FileEvent = {
          name: 'article__fr.md',
          path: '/notes/article__fr.md',
          type: 'markdown',
          action: 'create',
          timestamp: 1
        };

        expect(rule.shouldApply(event, context)).toBe(true);
      });

      it('should not apply to regular markdown files', () => {
        const event: FileEvent = {
          name: 'article.md',
          path: '/notes/article.md',
          type: 'markdown',
          action: 'create',
          timestamp: 1
        };

        expect(rule.shouldApply(event, context)).toBe(false);
      });

      it('should not apply to non-markdown files', () => {
        const event: FileEvent = {
          name: 'image__de.png',
          path: '/assets/image__de.png',
          type: 'asset',
          action: 'create',
          timestamp: 1
        };

        expect(rule.shouldApply(event, context)).toBe(false);
      });

      it('should not apply to markdown files without valid language pattern', () => {
        const event: FileEvent = {
          name: 'article_de.md', // Uses _ instead of __
          path: '/notes/article_de.md',
          type: 'markdown',
          action: 'create',
          timestamp: 1
        };

        expect(rule.shouldApply(event, context)).toBe(false);
      });
    });

    describe('transform', () => {
      it('should transform German language paths correctly', () => {
        const result = rule.transform('/article__de.md', context);
        expect(result).toBe('target/content/de/article.md');
      });

      it('should transform French language paths correctly', () => {
        const result = rule.transform('/article__fr.md', context);
        expect(result).toBe('target/content/fr/article.md');
      });

      it('should transform Spanish language paths correctly for nested files', () => {
        const result = rule.transform('/notes/blog/article__es.md', context);
        expect(result).toBe('target/content/es/notes/blog/article.md');
      });

      it('should handle paths without leading slash', () => {
        const result = rule.transform('docs/article__en.md', context);
        expect(result).toBe('target/content/en/docs/article.md');
      });

      it('should throw an error for invalid filenames', () => {
        expect(() => rule.transform('/article_invalid.md', context)).toThrow();
      });
    });
  });

  describe('Language Specific Rule', () => {
    const rule = createLanguageSpecificRule('de');

    it('should have the correct name', () => {
      expect(rule.name).toBe('DE Language Rule');
    });

    describe('shouldApply', () => {
      it('should apply to markdown files with specified language suffix', () => {
        const event: FileEvent = {
          name: 'article__de.md',
          path: '/notes/article__de.md',
          type: 'markdown',
          action: 'create',
          timestamp: 1
        };

        expect(rule.shouldApply(event, context)).toBe(true);
      });

      it('should not apply to markdown files with other language suffixes', () => {
        const event: FileEvent = {
          name: 'article__fr.md',
          path: '/notes/article__fr.md',
          type: 'markdown',
          action: 'create',
          timestamp: 1
        };

        expect(rule.shouldApply(event, context)).toBe(false);
      });
    });

    describe('transform', () => {
      it('should transform paths correctly for the specific language', () => {
        const result = rule.transform('/article__de.md', context);
        expect(result).toBe('target/content/de/article.md');
      });

      it('should handle nested paths correctly', () => {
        const result = rule.transform('/blog/post__de.md', context);
        expect(result).toBe('target/content/de/blog/post.md');
      });
    });
  });
});