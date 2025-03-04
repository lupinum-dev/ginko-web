import Dexie from 'dexie';
import { Notice } from 'obsidian';

/**
 * GinkoDB - Database for Ginko Web plugin using Dexie.js
 * This provides IndexedDB access with a clean API
 */
export class GinkoDB extends Dexie {
  // Define tables with their primary keys and indexes
  notes!: Dexie.Table<INoteItem, string>;
  settings!: Dexie.Table<ISetting, string>;

  constructor() {
    super('GinkoDB');
    console.log('Initializing GinkoDB with Dexie.js');

    // Define database schema
    this.version(1).stores({
      notes: 'id, path, title, content, lastModified, published',
      settings: 'key, value'
    });

    // Debug logging
    this.on('ready', () => console.log('GinkoDB is ready'));

    // Handle errors properly
    // Dexie doesn't support 'error' event directly, so we'll handle errors in each method
  }

  /**
   * Initialize the database
   */
  async init(): Promise<void> {
    try {
      console.log('Opening GinkoDB connection');
      await this.open();
      console.log('GinkoDB connection opened successfully');

      // Initialize default settings if needed
      const settingsCount = await this.settings.count();
      if (settingsCount === 0) {
        console.log('Initializing default settings');
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
      console.log('Saving note to database:', note.id);
      await this.notes.put(note);
      return note.id;
    } catch (error) {
      console.error('Failed to save note:', error);
      new Notice('Failed to save note to database');
      throw error;
    }
  }

  /**
   * Get a note by ID
   */
  async getNote(id: string): Promise<INoteItem | undefined> {
    try {
      console.log('Getting note from database:', id);
      return await this.notes.get(id);
    } catch (error) {
      console.error('Failed to get note:', error);
      new Notice('Failed to retrieve note from database');
      throw error;
    }
  }

  /**
   * Get all notes
   */
  async getAllNotes(): Promise<INoteItem[]> {
    try {
      console.log('Getting all notes from database');
      return await this.notes.toArray();
    } catch (error) {
      console.error('Failed to get all notes:', error);
      new Notice('Failed to retrieve notes from database');
      throw error;
    }
  }

  /**
   * Delete a note
   */
  async deleteNote(id: string): Promise<void> {
    try {
      console.log('Deleting note from database:', id);
      await this.notes.delete(id);
    } catch (error) {
      console.error('Failed to delete note:', error);
      new Notice('Failed to delete note from database');
      throw error;
    }
  }

  /**
   * Get a setting value
   */
  async getSetting(key: string): Promise<string | undefined> {
    try {
      console.log('Getting setting:', key);
      const setting = await this.settings.get(key);
      return setting?.value;
    } catch (error) {
      console.error('Failed to get setting:', error);
      new Notice('Failed to retrieve setting from database');
      throw error;
    }
  }

  /**
   * Save a setting
   */
  async saveSetting(key: string, value: string): Promise<void> {
    try {
      console.log('Saving setting:', key, value);
      await this.settings.put({ key, value });
    } catch (error) {
      console.error('Failed to save setting:', error);
      new Notice('Failed to save setting to database');
      throw error;
    }
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

export interface ISetting {
  key: string;
  value: string;
}

// Create and export a singleton instance
export const db = new GinkoDB();
