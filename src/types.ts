// src/types.ts
export type EventType = 'create' | 'modify' | 'delete' | 'rename';
export type FileType = 'markdown' | 'meta' | 'asset' | 'unknown';

// Event representing a file change
export interface FileEvent {
  name: string;
  path: string;
  type: FileType;
  action: EventType;
  oldPath?: string;
  content?: string;
  timestamp: number;
}

// Context available to all transform functions
export interface TransformContext {
  metaCache: Map<string, any>;
  assetMap: Map<string, string>;
  settings: SyncSettings;
}

// Configuration settings
export interface SyncSettings {
  targetBasePath: string;
  contentPath: string;
  assetsPath: string;
  excludePaths: string[];
  debug: boolean;
}

// Function type for path transformations
export type PathTransform = (path: string, context: TransformContext) => string;

// A rule is a function that may transform a path if conditions are met
export interface Rule {
  name: string;
  shouldApply: (event: FileEvent, context: TransformContext) => boolean;
  transform: PathTransform;
}

// File system operations
export interface FileSystem {
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<void>;
  deleteFile: (path: string) => Promise<void>;
  moveFile: (oldPath: string, newPath: string) => Promise<void>;
  createDirectory: (path: string) => Promise<void>;
  exists: (path: string) => Promise<boolean>;
}

// Default settings
export const DEFAULT_SETTINGS: SyncSettings = {
  targetBasePath: './target',
  contentPath: 'content',
  assetsPath: 'public/_assets',
  excludePaths: ['.obsidian', '.git', 'node_modules'],
  debug: false
};