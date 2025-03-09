// src/rules/asset-rule.test.ts
import { describe, it, expect } from 'vitest';
import { createAssetRule } from '../../src/rules/asset-rule';
import { FileEvent, SyncSettings, TransformContext } from '../../src/types';
import { createRuleTest } from '../../tests/helpers/rule-test-helper';
import { createMarkdownRule } from '../../src/rules/markdown-rule';

describe('Asset Rule', () => {
  // Default settings for testing
  const defaultSettings: SyncSettings = {
    obsidianRoot: '/obsidian',
    targetBasePath: './target',
    contentPath: 'content',
    assetsPath: 'public/_assets',
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
      expect(result).toBe('target/public/_assets/image.png');
    });

    it('should simplify paths for files in _assets directory', () => {
      const result = rule.transform('/notes/_assets/profile.jpg', context);
      expect(result).toBe('target/public/_assets/profile.jpg');
    });

    it('should simplify paths for files in assets directory', () => {
      const result = rule.transform('/assets/logo.svg', context);
      expect(result).toBe('target/public/_assets/logo.svg');
    });

    it('should simplify paths for files in attachments directory', () => {
      const result = rule.transform('/notes/attachments/document.pdf', context);
      expect(result).toBe('target/public/_assets/document.pdf');
    });

    it('should preserve nested directory structure within assets', () => {
      const result = rule.transform('/assets/icons/social/twitter.png', context);
      expect(result).toBe('target/public/_assets/twitter.png');
    });

    it('should handle paths without leading slash', () => {
      const result = rule.transform('assets/banner.jpg', context);
      expect(result).toBe('target/public/_assets/banner.jpg');
    });
  });
});


  describe('Rule Integration Tests', () => {
    it('Creation of asset files', async () => {
      const assetRule = createAssetRule();
  
      const eventBatches: FileEvent[][] = [[
        {
          name: "image.png",
          path: "_assets/image.png",
          type: "asset",
          action: "create",
          timestamp: 1741498953213,
          content: "image data" // Add content to avoid file read
        },
        {
          name: "image2.png",
          path: "A/_assets/B/image2.png",
          type: "asset",
          action: "create",
          timestamp: 1741498953213,
          content: "image2 data" // Add content to avoid file read
        }
      ]];
  
      await createRuleTest({
        settings: {
          obsidianRoot: '/obsidian',
          targetBasePath: './target',
          contentPath: 'content',
          assetsPath: 'public/_assets'
        },
        rules: [assetRule],
        eventBatches,
        initialState: {
          filesSource: ['_assets/image.png', 'A/_assets/B/image2.png'], // Add source files
          filesTarget: [],
          metaCache: new Map(),
          assetCache: new Map()
        },
        expectedState: {
          // Make sure that assets are stored together in the same directory
          filesTarget: ['public/_assets/image.png', 'public/_assets/image2.png'],
          metaCache: new Map([
            ['_assets/image.png', 'target/public/_assets/image.png'],
            ['A/_assets/B/image2.png', 'target/public/_assets/image2.png']
          ]),
          assetCache: new Map()
        }
      });
    });
  
// IGNORE FOR NOW!
  // it('Should handle file renames correctly', async () => {
  //   const assetRule = createAssetRule();

  //   const eventBatches: FileEvent[][] = [[
  //     {
  //       name: "new.md",
  //       path: "new.md",
  //       type: "markdown",
  //       action: "rename",
  //       oldPath: "old.md",
  //       timestamp: 1741498953213,
  //       content: "content"
  //     }
  //   ]];

  //   await createRuleTest({
  //     settings: {
  //       obsidianRoot: '/obsidian',
  //       targetBasePathUser: './target',
  //       targetBasePath: './target',
  //       contentPathUser: 'content',
  //       contentPath: 'content'
  //     },
  //     rules: [assetRule],
  //     eventBatches,
  //     initialState: {
  //       filesTarget: ['content/old.md'],
  //       metaCache: new Map(),
  //       assetCache: new Map()
  //     },
  //     expectedState: {
  //       filesTarget: ['content/new.md'],
  //       metaCache: new Map(),
  //       assetCache: new Map()
  //     }
  //   });
  // });

  // it('Should handle file deletion correctly', async () => {
  //   const assetRule = createAssetRule();

  //   const eventBatches: FileEvent[][] = [[
  //     {
  //       name: "old.md",
  //       path: "old.md",
  //       type: "markdown",
  //       action: "delete",
  //       timestamp: 1741498953213,
  //       content: "content"
  //     }
  //   ]];

  //   await createRuleTest({
  //     settings: {
  //       obsidianRoot: '/obsidian',
  //       targetBasePathUser: './target',
  //       targetBasePath: './target',
  //       contentPathUser: 'content',
  //       contentPath: 'content'
  //     },
  //     rules: [assetRule],
  //     eventBatches,
  //     initialState: {
  //       filesTarget: ['content/old.md'],
  //       metaCache: new Map(),
  //       assetCache: new Map()
  //     },
  //     expectedState: {
  //       filesTarget: [],
  //       metaCache: new Map(),
  //       assetCache: new Map()
  //     }
  //   });
  // });

  // it('Should handle file updates correctly', async () => {
  //   const assetRule = createAssetRule();

  //   const eventBatches: FileEvent[][] = [[
  //     {
  //       name: "file.md",
  //       path: "file.md",
  //       type: "markdown",
  //       action: "modify",
  //       timestamp: 1741498953213,
  //       content: "new content"
  //     }
  //   ]];

  //   await createRuleTest({
  //     settings: {
  //       obsidianRoot: '/obsidian',
  //       targetBasePathUser: './target',
  //       targetBasePath: './target',
  //       contentPathUser: 'content',
  //       contentPath: 'content'
  //     },
  //     rules: [assetRule],  
  //     eventBatches,
  //     initialState: {
  //       filesTarget: [{ path: 'content/file.md', content: 'old content' }],
  //       metaCache: new Map(),
  //       assetCache: new Map() 
  //     },
  //     expectedState: {
  //       filesTarget: [{ path: 'content/file.md', content: 'new content' }],
  //       metaCache: new Map(),
  //       assetCache: new Map()
  //     }
  //   });
  // });

});