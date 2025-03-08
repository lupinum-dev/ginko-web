// src/rules/asset-rule.test.ts
import { describe, it, expect } from 'vitest';
import { createAssetRule } from '../../src/rules/asset-rule';
import { FileEvent, SyncSettings, TransformContext } from '../../src/types';

describe('Asset Rule', () => {
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

  const rule = createAssetRule();

  it('should have the correct name', () => {
    expect(rule.name).toBe('Asset Rule');
  });

  describe('shouldApply', () => {
    it('should apply to files explicitly marked as assets', () => {
      const event: FileEvent = {
        name: 'diagram.png',
        path: '/diagrams/diagram.png',
        type: 'asset', // Explicitly marked as asset
        action: 'create',
        timestamp: 1
      };

      expect(rule.shouldApply(event, context)).toBe(true);
    });

    it('should apply to files in _assets directory', () => {
      const event: FileEvent = {
        name: 'profile.jpg',
        path: '/notes/_assets/profile.jpg',
        type: 'unknown', // Type doesn't matter when in assets dir
        action: 'create',
        timestamp: 1
      };

      expect(rule.shouldApply(event, context)).toBe(true);
    });

    it('should apply to files in assets directory', () => {
      const event: FileEvent = {
        name: 'logo.svg',
        path: '/assets/logo.svg',
        type: 'unknown',
        action: 'create',
        timestamp: 1
      };

      expect(rule.shouldApply(event, context)).toBe(true);
    });

    it('should apply to files in attachments directory', () => {
      const event: FileEvent = {
        name: 'document.pdf',
        path: '/attachments/document.pdf',
        type: 'unknown',
        action: 'create',
        timestamp: 1
      };

      expect(rule.shouldApply(event, context)).toBe(true);
    });

    it('should not apply to regular markdown files', () => {
      const event: FileEvent = {
        name: 'note.md',
        path: '/notes/note.md',
        type: 'markdown',
        action: 'create',
        timestamp: 1
      };

      expect(rule.shouldApply(event, context)).toBe(false);
    });
  });

  describe('transform', () => {
    it('should transform paths correctly for root level assets', () => {
      const result = rule.transform('/image.png', context);
      expect(result).toBe('target/public/assets/image.png');
    });

    it('should simplify paths for files in _assets directory', () => {
      const result = rule.transform('/notes/_assets/profile.jpg', context);
      expect(result).toBe('target/public/assets/notes/profile.jpg');
    });

    it('should simplify paths for files in assets directory', () => {
      const result = rule.transform('/assets/logo.svg', context);
      expect(result).toBe('target/public/assets/logo.svg');
    });

    it('should simplify paths for files in attachments directory', () => {
      const result = rule.transform('/notes/attachments/document.pdf', context);
      expect(result).toBe('target/public/assets/notes/document.pdf');
    });

    it('should preserve nested directory structure within assets', () => {
      const result = rule.transform('/assets/icons/social/twitter.png', context);
      expect(result).toBe('target/public/assets/icons/social/twitter.png');
    });

    it('should handle paths without leading slash', () => {
      const result = rule.transform('assets/banner.jpg', context);
      expect(result).toBe('target/public/assets/banner.jpg');
    });
  });
});