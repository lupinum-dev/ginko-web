// src/rules/markdown-rule.test.ts
import { describe, it, expect } from 'vitest';
import { createMarkdownRule } from '../../src/rules/markdown-rule';
import { createAssetRule } from '../../src/rules/asset-rule';
import { createRuleTest } from '../helpers/rule-test-helper';
import { FileEvent, SyncSettings, TransformContext } from '../../src/types';
import { createLocalizedMarkdownRule } from '../../src/rules/localized-markdown-rule';

describe('Markdown Rule Unit Tests', () => {
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
    logToDisk: false,
    logFilePath: '.obsidian/plugins/ginko'
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
        name: '_meta.md',
        path: '/notes/_meta.md',
        type: 'meta',
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

});

describe('Rule Integration Tests', () => {
  it('Creation of markdown files', async () => {
    const markdownRule = createMarkdownRule();

    const eventBatches: FileEvent[][] = [[
      {
        name: "a.md",
        path: "a.md",
        type: "markdown",
        action: "create",
        timestamp: 1741498953213,
        content: "a"
      },
      {
        name: "b__de.md",
        path: "A/b__de.md",
        type: "markdown",
        action: "create",
        timestamp: 1741498953213,
        content: "b"
      }
    ]];

    await createRuleTest({
      settings: {
        obsidianRoot: '/obsidian',
        targetBasePathUser: './target',
        targetBasePath: './target',
        contentPathUser: 'content',
        contentPath: 'content'
      },
      rules: [markdownRule],
      eventBatches,
      initialState: {
        filesTarget: [],
        metaCache: new Map(),
        assetCache: new Map()
      },
      expectedState: {
        filesTarget: ['content/a.md', 'content/A/b__de.md'],
        metaCache: new Map(),
        assetCache: new Map()
      }
    });
  });

  it('Should handle file renames correctly', async () => {
    const markdownRule = createMarkdownRule();

    const eventBatches: FileEvent[][] = [[
      {
        name: "new.md",
        path: "new.md",
        type: "markdown",
        action: "rename",
        oldPath: "old.md",
        timestamp: 1741498953213,
        content: "content"
      }
    ]];

    await createRuleTest({
      settings: {
        obsidianRoot: '/obsidian',
        targetBasePathUser: './target',
        targetBasePath: './target',
        contentPathUser: 'content',
        contentPath: 'content'
      },
      rules: [markdownRule],
      eventBatches,
      initialState: {
        filesTarget: ['content/old.md'],
        metaCache: new Map(),
        assetCache: new Map()
      },
      expectedState: {
        filesTarget: ['content/new.md'],
        metaCache: new Map(),
        assetCache: new Map()
      }
    });
  });

  it('Should handle file deletion correctly', async () => {
    const markdownRule = createMarkdownRule();

    const eventBatches: FileEvent[][] = [[
      {
        name: "old.md",
        path: "old.md",
        type: "markdown",
        action: "delete",
        timestamp: 1741498953213,
        content: "content"
      }
    ]];

    await createRuleTest({
      settings: {
        obsidianRoot: '/obsidian',
        targetBasePathUser: './target',
        targetBasePath: './target',
        contentPathUser: 'content',
        contentPath: 'content'
      },
      rules: [markdownRule],
      eventBatches,
      initialState: {
        filesTarget: ['content/old.md'],
        metaCache: new Map(),
        assetCache: new Map()
      },
      expectedState: {
        filesTarget: [],
        metaCache: new Map(),
        assetCache: new Map()
      }
    });
  });

  it('Should handle file updates correctly', async () => {
    const markdownRule = createMarkdownRule();

    const eventBatches: FileEvent[][] = [[
      {
        name: "file.md",
        path: "file.md",
        type: "markdown",
        action: "modify",
        timestamp: 1741498953213,
        content: "new content"
      }
    ]];

    await createRuleTest({
      settings: {
        obsidianRoot: '/obsidian',
        targetBasePathUser: './target',
        targetBasePath: './target',
        contentPathUser: 'content',
        contentPath: 'content'
      },
      rules: [markdownRule],
      eventBatches,
      initialState: {
        filesTarget: [{path: 'content/file.md', content: 'old content'}],
        metaCache: new Map(),
        assetCache: new Map()
      },
      expectedState: {
        filesTarget: [{path: 'content/file.md', content: 'new content'}],
        metaCache: new Map(),
        assetCache: new Map()
      }
    });
  });

});