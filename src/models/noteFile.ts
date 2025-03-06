import { File } from './file';
import path from 'path';

/**
 * NoteFile class
 * Represents markdown notes that may have dependencies on other files
 */
export class NoteFile extends File {
  private content: string;

  /**
   * Creates a new NoteFile instance
   * @param path - Absolute file path
   * @param name - File name
   * @param content - Markdown content
   * @param relativePath - Path relative to the root directory
   */
  constructor(path: string, name: string, content: string, relativePath: string) {
    super(path, relativePath, name);
    this.content = content;
  }

  /**
   * Get the markdown content
   * @returns The file content
   */
  getContent(): string {
    return this.content;
  }

  /**
   * Extract image references from markdown content and resolve paths
   * @returns Array of image paths referenced in the note
   */
  getImageDependencies(): string[] {
    // Match Markdown image syntax: ![alt text](image-path)
    const imageRegex = /!\[.*?\]\((.*?)\)/g;
    const matches = [...this.content.matchAll(imageRegex)];
    
    if (matches.length === 0) {
      return [];
    }
    
    // Get the directory of this note
    const noteDir = path.dirname(this.relativePath);
    
    // Normalize and resolve image paths
    return matches.map(match => {
      // Get the raw image path from the match
      let imagePath = match[1].trim();
      
      // Remove any URL fragments or query parameters
      imagePath = imagePath.split('#')[0].split('?')[0];
      
      // Handle relative paths 
      if (!imagePath.startsWith('/')) {
        // It's a relative path, resolve it from the note's location
        imagePath = path.join(noteDir, imagePath);
      } else {
        // It's an absolute path (from vault root), remove leading slash
        imagePath = imagePath.substring(1);
      }
      
      // Normalize path separators to forward slashes
      return imagePath.replace(/\\/g, '/');
    });
  }

  /**
   * Get all dependencies for this note 
   * @returns Array of dependency paths
   */
  getDependencies(): string[] {
    return this.getImageDependencies();
  }

  /**
   * Serialize to JSON with content included
   * @returns JSON representation including content
   */
  toJSON(): Record<string, any> {
    return {
      ...super.toJSON(),
      content: this.content
    };
  }
}