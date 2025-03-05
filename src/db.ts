import Dexie from 'dexie';
import { Notice } from 'obsidian';

/**
 * GinkoDB - Database for Ginko Web plugin using Dexie.js
 * This provides IndexedDB access with a clean API
 */
export class GinkoDB extends Dexie {
  // Define tables with their primary keys and indexes
  notes!: Dexie.Table<INoteItem, string>;
  assets!: Dexie.Table<IAssetItem, string>;
  settings!: Dexie.Table<ISetting, string>;

  constructor() {
    super('GinkoDB');

    // Define database schema
    this.version(1).stores({
      notes: 'id, path, title, content, lastModified, published',
      assets: 'id, path, lastModified',
      settings: 'key, value'
    });

    // Debug logging only in development
    if (process.env.NODE_ENV === 'development') {
      this.on('ready', () => console.log('GinkoDB is ready'));
    }
  }

  /**
   * Initialize the database
   */
  async init(): Promise<void> {
    try {
      await this.open();

      // Initialize default settings if needed
      const settingsCount = await this.settings.count();
      if (settingsCount === 0) {
        await this.settings.bulkPut([
          { key: 'lastSync', value: '0' },
          { key: 'publishMode', value: 'manual' }
        ]);
      }
    } catch (error) {
      console.error('Failed to initialize GinkoDB:', error);
      new Notice('Database initialization failed');
      throw error;
    }
  }

  /**
   * Save a note to the database
   */
  async saveNote(note: INoteItem): Promise<string> {
    try {
      await this.notes.put(note);
      return note.id;
    } catch (error) {
      console.error('Failed to save note:', error);
      throw error;
    }
  }

  /**
   * Save multiple notes in a batch operation
   */
  async saveNotes(notes: INoteItem[]): Promise<void> {
    try {
      // Use bulkPut within a transaction for better performance and atomicity
      await this.transaction('rw', this.notes, async () => {
        return await this.notes.bulkPut(notes);
      });
    } catch (error) {
      console.error('Failed to save notes in batch:', error);
      throw error;
    }
  }

  /**
   * Get a note by ID
   */
  async getNote(id: string): Promise<INoteItem | undefined> {
    try {
      return await this.notes.get(id);
    } catch (error) {
      console.error('Failed to get note:', error);
      throw error;
    }
  }

  /**
   * Get all notes
   */
  async getAllNotes(): Promise<INoteItem[]> {
    try {
      return await this.notes.toArray();
    } catch (error) {
      console.error('Failed to get all notes:', error);
      throw error;
    }
  }

  /**
   * Delete a note
   */
  async deleteNote(id: string): Promise<void> {
    try {
      await this.notes.delete(id);
    } catch (error) {
      console.error('Failed to delete note:', error);
      throw error;
    }
  }

  /**
   * Get a setting value
   */
  async getSetting(key: string): Promise<string | undefined> {
    try {
      const setting = await this.settings.get(key);
      return setting?.value;
    } catch (error) {
      console.error('Failed to get setting:', error);
      throw error;
    }
  }

  /**
   * Save a setting
   */
  async saveSetting(key: string, value: string): Promise<void> {
    try {
      await this.settings.put({ key, value });
    } catch (error) {
      console.error('Failed to save setting:', error);
      throw error;
    }
  }

  /**
   * Save an asset to the database
   */
  async saveAsset(asset: IAssetItem): Promise<string> {
    try {
      await this.assets.put(asset);
      return asset.id;
    } catch (error) {
      console.error('Failed to save asset:', error);
      throw error;
    }
  }

  /**
   * Save multiple assets in a batch operation
   */
  async saveAssets(assets: IAssetItem[]): Promise<void> {
    try {
      // Use bulkPut within a transaction for better performance and atomicity
      await this.transaction('rw', this.assets, async () => {
        return await this.assets.bulkPut(assets);
      });
    } catch (error) {
      console.error('Failed to save assets in batch:', error);
      throw error;
    }
  }

  /**
   * Get an asset by ID
   */
  async getAsset(id: string): Promise<IAssetItem | undefined> {
    try {
      return await this.assets.get(id);
    } catch (error) {
      console.error('Failed to get asset:', error);
      throw error;
    }
  }

  /**
   * Get an asset by path
   */
  async getAssetByPath(path: string): Promise<IAssetItem | undefined> {
    try {
      return await this.assets.where('path').equals(path).first();
    } catch (error) {
      console.error('Failed to get asset by path:', error);
      throw error;
    }
  }

  /**
   * Get all assets
   */
  async getAllAssets(): Promise<IAssetItem[]> {
    try {
      return await this.assets.toArray();
    } catch (error) {
      console.error('Failed to get all assets:', error);
      throw error;
    }
  }

  /**
   * Delete an asset
   */
  async deleteAsset(id: string): Promise<void> {
    try {
      await this.assets.delete(id);
    } catch (error) {
      console.error('Failed to delete asset:', error);
      throw error;
    }
  }

  /**
   * Get a note by path
   */
  async getNoteByPath(path: string): Promise<INoteItem | undefined> {
    try {
      return await this.notes.where('path').equals(path).first();
    } catch (error) {
      console.error('Failed to get note by path:', error);
      throw error;
    }
  }

  /**
   * Get multiple notes by their paths
   */
  async getNotesByPaths(paths: string[]): Promise<Record<string, INoteItem | undefined>> {
    try {
      const result: Record<string, INoteItem | undefined> = {};

      // Use a transaction for better performance
      await this.transaction('r', this.notes, async () => {
        // Create a map for faster lookups
        const noteMap = new Map<string, INoteItem>();

        // Get all notes that match the paths
        const notes = await this.notes.where('path').anyOf(paths).toArray();

        // Populate the map
        for (const note of notes) {
          noteMap.set(note.path, note);
        }

        // Populate the result object
        for (const path of paths) {
          result[path] = noteMap.get(path);
        }

        return;
      });

      return result;
    } catch (error) {
      console.error('Failed to get notes by paths:', error);
      throw error;
    }
  }

  /**
   * Get multiple assets by their paths
   */
  async getAssetsByPaths(paths: string[]): Promise<Record<string, IAssetItem | undefined>> {
    try {
      const result: Record<string, IAssetItem | undefined> = {};

      // Use a transaction for better performance
      await this.transaction('r', this.assets, async () => {
        // Create a map for faster lookups
        const assetMap = new Map<string, IAssetItem>();

        // Get all assets that match the paths
        const assets = await this.assets.where('path').anyOf(paths).toArray();

        // Populate the map
        for (const asset of assets) {
          assetMap.set(asset.path, asset);
        }

        // Populate the result object
        for (const path of paths) {
          result[path] = assetMap.get(path);
        }

        return;
      });

      return result;
    } catch (error) {
      console.error('Failed to get assets by paths:', error);
      throw error;
    }
  }

  /**
   * Clear all data from the database
   */
  async clearAllData(): Promise<void> {
    try {
      // Use a transaction to ensure atomicity when clearing all tables
      await this.transaction('rw', [this.notes, this.assets], async () => {
        await this.notes.clear();
        await this.assets.clear();
        return;
      });
    } catch (error) {
      console.error('Failed to clear database:', error);
      throw error;
    }
  }

  /**
   * Execute a transaction on the database
   * This provides a way to perform multiple operations in a single transaction
   */
  async executeTransaction<T>(
    mode: 'r' | 'rw',
    tables: Array<Dexie.Table<any, any>>,
    callback: (trans: any) => Promise<T>
  ): Promise<T> {
    try {
      // Convert mode string to Dexie.TransactionMode
      const transactionMode = mode === 'rw' ? 'readwrite' : 'readonly';

      // Use the instance transaction method
      return await this.transaction(transactionMode, tables, async (trans) => {
        return await callback(trans);
      });
    } catch (error) {
      console.error('Transaction failed:', error);
      throw error;
    }
  }

  /**
   * Get direct access to the notes table
   * This is for advanced usage only, when you need direct access to the Dexie table
   */
  getNotesTable(): Dexie.Table<INoteItem, string> {
    return this.notes;
  }

  /**
   * Get direct access to the assets table
   * This is for advanced usage only, when you need direct access to the Dexie table
   */
  getAssetsTable(): Dexie.Table<IAssetItem, string> {
    return this.assets;
  }

  /**
   * Get direct access to the settings table
   * This is for advanced usage only, when you need direct access to the Dexie table
   */
  getSettingsTable(): Dexie.Table<ISetting, string> {
    return this.settings;
  }
}

// Define interfaces for database objects
export interface INoteItem {
  id: string;
  path: string;
  title: string;
  content: string;
  lastModified: number;
  published: boolean;
}

export interface IAssetItem {
  id: string;
  path: string;
  lastModified: number;
}

export interface ISetting {
  key: string;
  value: string;
}

// Create and export a singleton instance
export const db = new GinkoDB();
