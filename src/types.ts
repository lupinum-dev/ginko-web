// src/types.ts
import type { TFile } from 'obsidian';

export type EventType = 'create' | 'modify' | 'delete' | 'rename';
export type FileType = 'markdown' | 'meta' | 'asset' | 'unknown';

export interface SyncEvent {
  name: string;
  path: string;
  type: FileType;
  action: EventType;
  oldPath?: string;
  content?: string;
  timestamp: number;
}

export interface SyncSettings {
  targetBasePath: string;
  excludePaths: string[];
  debugMode: boolean;
}

export const DEFAULT_SETTINGS: SyncSettings = {
  targetBasePath: './target',
  excludePaths: ['.obsidian', '.git', 'node_modules'],
  debugMode: false
};

// For testing
export interface FileSystem {
  mkdir(path: string, options?: { recursive: boolean }): Promise<void>;
  writeFile(path: string, content: string, encoding?: string): Promise<void>;
  readFile(path: string, encoding?: string): Promise<string>;
  rm(path: string, options?: { recursive: boolean, force: boolean }): Promise<void>;
  access(path: string): Promise<boolean>;
}