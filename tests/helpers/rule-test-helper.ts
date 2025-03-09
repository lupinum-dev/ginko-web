import { FileEvent, FileSystem, Rule, SyncSettings, TransformContext } from '../../src/types';
import { createMockFileSystem } from '../../src/utils/file-system';
import { processBatch } from '../../src/core/sync-engine';
import * as path from 'path';
import { expect } from 'vitest';

// Add new type for target file format
export type TargetFile = string | { path: string; content: string };

export interface RuleTestState {
  filesSource: string[];
  filesTarget: TargetFile[];
  metaCache: Map<string, any>;
  assetCache: Map<string, any>;
}

export interface RuleTestConfig {
  settings: Partial<SyncSettings>;
  rules: Rule[];
  eventBatches: FileEvent[][];
  initialState?: Partial<RuleTestState>;
  expectedState?: Partial<RuleTestState>;
}

export interface MockFileSystemState {
  files: Map<string, string>;
  directories: Set<string>;
}

export class RuleTestHelper {
  private fs: FileSystem;
  private settings: SyncSettings;
  private state: RuleTestState;
  private fsState: MockFileSystemState;
  private rules: Rule[];

  constructor(config: RuleTestConfig) {
    this.fsState = {
      files: new Map(),
      directories: new Set()
    };
    this.fs = this.createMockFileSystem();
    this.settings = this.createSettings(config.settings);
    this.state = this.createInitialState(config.initialState);
    this.rules = config.rules;
    
    // Initialize source files
    if (this.state.filesSource) {
      for (const file of this.state.filesSource) {
        this.fsState.files.set(file, '');
        const dir = path.dirname(file);
        if (dir !== '.') {
          this.fsState.directories.add(dir);
        }
      }
    }

    // Initialize target files if any
    if (this.state.filesTarget) {
      for (const file of this.state.filesTarget) {
        const filePath = typeof file === 'string' ? file : file.path;
        const content = typeof file === 'string' ? '' : file.content;
        const fullPath = path.join('target', filePath);
        this.fsState.files.set(fullPath, content);
        const dir = path.dirname(fullPath);
        if (dir !== '.') {
          this.fsState.directories.add(dir);
        }
      }
    }
  }

  private createMockFileSystem(): FileSystem {
    return {
      readFile: async (filePath: string): Promise<string> => {
        const normalizedPath = this.normalizePath(filePath);
        const content = this.fsState.files.get(normalizedPath);
        if (content === undefined) {
          throw new Error(`File not found: ${normalizedPath}`);
        }
        return content;
      },

      writeFile: async (filePath: string, content: string): Promise<void> => {
        const normalizedPath = this.normalizePath(filePath);
        const dir = path.dirname(normalizedPath);
        if (dir !== '.') {
          this.fsState.directories.add(dir);
        }
        this.fsState.files.set(normalizedPath, content);
      },

      deleteFile: async (filePath: string): Promise<void> => {
        const normalizedPath = this.normalizePath(filePath);
        if (!this.fsState.files.has(normalizedPath)) {
          throw new Error(`File not found: ${normalizedPath}`);
        }
        this.fsState.files.delete(normalizedPath);
      },

      moveFile: async (oldPath: string, newPath: string): Promise<void> => {
        const normalizedOldPath = this.normalizePath(oldPath);
        const normalizedNewPath = this.normalizePath(newPath);
        const content = this.fsState.files.get(normalizedOldPath);
        if (content === undefined) {
          throw new Error(`File not found: ${normalizedOldPath}`);
        }
        const newDir = path.dirname(normalizedNewPath);
        if (newDir !== '.') {
          this.fsState.directories.add(newDir);
        }
        this.fsState.files.set(normalizedNewPath, content);
        this.fsState.files.delete(normalizedOldPath);
      },

      createDirectory: async (dirPath: string): Promise<void> => {
        const normalizedPath = this.normalizePath(dirPath);
        this.fsState.directories.add(normalizedPath);
      },

      exists: async (filePath: string): Promise<boolean> => {
        const normalizedPath = this.normalizePath(filePath);
        return this.fsState.files.has(normalizedPath) || 
               this.fsState.directories.has(normalizedPath);
      }
    };
  }

  private normalizePath(filePath: string): string {
    // Remove leading ./ and / from paths
    return path.normalize(filePath)
      .replace(/^\.\//, '')
      .replace(/^\//, '');
  }

  private createSettings(partialSettings: Partial<SyncSettings>): SyncSettings {
    return {
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
      logFilePath: '.obsidian/plugins/ginko',
      ...partialSettings
    };
  }

  private createInitialState(initialState?: Partial<RuleTestState>): RuleTestState {
    return {
      filesSource: [],
      filesTarget: [],
      metaCache: new Map(),
      assetCache: new Map(),
      ...initialState
    };
  }

  async processEvents(eventBatches: FileEvent[][]): Promise<void> {
    const metaContext = {
      metaCache: this.state.metaCache
    };
    
    for (const batch of eventBatches) {
      // Modify each event to include context access
      const processEvents = batch.map(event => ({
        ...event,
        metaContext
      }));
      
      await processBatch(processEvents, this.settings, this.rules, undefined, this.fs);
    }
  }

  async getTargetFiles(): Promise<TargetFile[]> {
    // Get all files from the mock filesystem that are in the target directory
    const targetFiles: TargetFile[] = [];
    for (const [filePath, content] of this.fsState.files) {
      if (filePath.startsWith('target/')) {
        const relativePath = filePath.replace(/^target\//, '');
        // If the expected state uses objects with content, return that format
        if (this.state.filesTarget?.some(f => typeof f === 'object')) {
          targetFiles.push({
            path: relativePath,
            content: content
          });
        } else {
          // Otherwise just return the path
          targetFiles.push(relativePath);
        }
      }
    }
    return targetFiles.sort((a, b) => {
      const pathA = typeof a === 'string' ? a : a.path;
      const pathB = typeof b === 'string' ? b : b.path;
      return pathA.localeCompare(pathB);
    });
  }

  getMetaCache(): Map<string, any> {
    return this.state.metaCache;
  }

  getAssetCache(): Map<string, any> {
    return this.state.assetCache;
  }

  private debugArrays(actual: TargetFile[], expected: TargetFile[]): void {
    console.log('\nArray Comparison Debug:');
    console.log('Actual files:  ', JSON.stringify(actual, null, 2));
    console.log('Expected files:', JSON.stringify(expected, null, 2));
    
    // Find differences
    const onlyInActual = actual.filter(a => {
      return !expected.some(e => {
        const aPath = typeof a === 'string' ? a : a.path;
        const ePath = typeof e === 'string' ? e : e.path;
        return aPath === ePath;
      });
    });
    
    const onlyInExpected = expected.filter(e => {
      return !actual.some(a => {
        const aPath = typeof a === 'string' ? a : a.path;
        const ePath = typeof e === 'string' ? e : e.path;
        return aPath === ePath;
      });
    });
    
    if (onlyInActual.length > 0) {
      console.log('\nFiles only in actual:', JSON.stringify(onlyInActual, null, 2));
    }
    if (onlyInExpected.length > 0) {
      console.log('Files only in expected:', JSON.stringify(onlyInExpected, null, 2));
    }
  }

  async verifyState(expectedState: Partial<RuleTestState>): Promise<void> {
    if (expectedState.filesTarget) {
      const actualFiles = await this.getTargetFiles();
      
      // Debug arrays before comparison
      this.debugArrays(actualFiles, expectedState.filesTarget);
      
      expect(actualFiles).toEqual(expectedState.filesTarget);
    }

    if (expectedState.metaCache) {
      expect(this.state.metaCache).toEqual(expectedState.metaCache);
    }

    if (expectedState.assetCache) {
      expect(this.state.assetCache).toEqual(expectedState.assetCache);
    }
  }
}

export const createRuleTest = async (config: RuleTestConfig): Promise<void> => {
  const helper = new RuleTestHelper(config);
  
  // Pre-fill the metaCache for the test
  if (config.initialState?.metaCache && config.initialState.metaCache.size > 0) {
    // We'll keep using this metaCache throughout processing
  } else if (config.expectedState?.metaCache) {
    // Create an empty Map for initialization
    helper.state.metaCache = new Map();
  }
  
  await helper.processEvents(config.eventBatches);
  
  if (config.expectedState) {
    await helper.verifyState(config.expectedState);
  }
}; 