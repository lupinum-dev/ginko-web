// src/types.ts

// Event Types
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

// Plugin settings
export interface SyncSettings {
  readonly obsidianRoot: string;
  readonly targetBasePathUser: string;
  readonly targetBasePath: string;
  readonly contentPathUser: string;
  readonly contentPath: string;
  readonly assetsPathUser: string;
  readonly assetsPath: string;
  readonly excludePaths: string[];
  readonly excludeFiles: string[];
  readonly debug: boolean;
  readonly logToDisk: boolean;
  readonly logFilePath: string;
}

// Default settings
export const DEFAULT_SETTINGS: SyncSettings = {
  obsidianRoot: '',
  targetBasePathUser: './target',
  targetBasePath: './target',
  contentPathUser: 'content',
  contentPath: 'content',
  assetsPathUser: 'public/_assets',
  assetsPath: 'public/_assets',
  excludePaths: ['.obsidian', '.git', 'node_modules'],
  excludeFiles: [],
  debug: false,
  logToDisk: false,
  logFilePath: '.obsidian/plugins/ginko/log.txt'
};

// Processing order for file types
export const SORT_ORDER: ReadonlyArray<FileType> = ['meta', 'markdown', 'asset', 'unknown'];

// Log level types
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// Logger interface
export interface Logger {
  debug: (module: string, message: string) => void;
  info: (module: string, message: string) => void;
  warn: (module: string, message: string) => void;
  error: (module: string, message: string) => void;
  dispose: () => Promise<void>;
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

// Context for transform functions
export interface TransformContext {
  readonly metaCache: ReadonlyMap<string, any>;
  readonly assetMap: ReadonlyMap<string, string>;
  readonly settings: SyncSettings;
}

// Path transformation function type
export type PathTransform = (path: string, context: TransformContext) => string;

// Rule for file transformations
export interface Rule {
  readonly name: string;
  readonly shouldApply: (event: FileEvent, context: TransformContext) => boolean;
  readonly transform: PathTransform;
}

// Queue state
export interface QueueState {
  readonly events: ReadonlyArray<FileEvent>;
  readonly isProcessing: boolean;
}