// types.ts
import { TFile, TFolder } from 'obsidian';

/**
 * Supported event types from Obsidian vault
 */
export type EventType = 'create' | 'modify' | 'delete' | 'rename';

/**
 * Supported frameworks for target projects
 */
export type Framework = 'generic' | 'nextjs' | 'nuxtjs' | 'custom';

/**
 * Event object representing a file operation in the vault
 */
export interface VaultEvent {
  type: EventType;
  file: TFile;
  timestamp: number;
  oldPath?: string; // Only for rename events
}

/**
 * Rule interface that all rule modules must implement
 */
export interface Rule {
  name: string;
  targetBase: string;
  applyRule(filePath: string, operation: EventType, metadata?: Record<string, any>): string;
}

/**
 * Plugin settings interface
 */
export interface VaultSyncSettings {
  framework: Framework;
  targetBase: string;
  languages: string[];
  excludeFolders: string[];
  debounceTime: number;
  debugMode: boolean;
  nextjsConfig: {
    contentDir: string;
  };
  nuxtjsConfig: {
    contentDir: string;
  };
  customRules: Record<string, any>;
}

/**
 * Default settings
 */
export const DEFAULT_SETTINGS: VaultSyncSettings = {
  framework: 'generic',
  targetBase: './content',
  languages: ['en', 'de', 'fr'],
  excludeFolders: ['.obsidian', 'templates'],
  debounceTime: 500,
  debugMode: false,
  nextjsConfig: {
    contentDir: './content'
  },
  nuxtjsConfig: {
    contentDir: './content'
  },
  customRules: {}
};