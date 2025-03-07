// src/types.ts
import type { TFile } from 'obsidian';

export type EventType = 'create' | 'modify' | 'delete' | 'rename';

export interface SyncEvent {
  name: string;
  path: string;
  action: EventType;
  oldPath?: string;
  content?: string;
  timestamp: number;
}

// Rule interface - all rules must implement this
export interface Rule {
  name: string;
  priority: number;
  apply(event: SyncEvent, context: RuleContext): SyncEvent;
  shouldApply(event: SyncEvent): boolean;
}

// Context provided to rules when they're applied
export interface RuleContext {
  metaCache: Map<string, any>; // Path -> parsed meta content
  targetBasePath: string;
  contentPath: string;
  assetsPath: string;
  debug: boolean;
}

export interface SyncSettings {
  targetBasePath: string;
  contentPath: string;
  assetsPath: string;
  excludePaths: string[];
  debugMode: boolean;
  activeRules: string[]; // Names of rules to apply
}

export const DEFAULT_SETTINGS: SyncSettings = {
  targetBasePath: './target',
  contentPath: 'content',
  assetsPath: 'public/_assets',
  excludePaths: ['.obsidian', '.git', 'node_modules'],
  debugMode: false,
  activeRules: ['generic', 'language'] // Default to generic and language rules
};

// For testing
export interface FileSystem {
  mkdir(path: string, options?: { recursive: boolean }): Promise<void>;
  writeFile(path: string, content: string, encoding?: string): Promise<void>;
  readFile(path: string, encoding?: string): Promise<string>;
  rm(path: string, options?: { recursive: boolean, force: boolean }): Promise<void>;
  access(path: string): Promise<boolean>;
}