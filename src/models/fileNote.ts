import { fileBase } from './fileBase';
import * as path from 'path';

/**
 * NoteFile class
 * Represents markdown notes that may have dependencies on other files
 */
export class fileNote extends fileBase {
  private content: string;

  /**
   * Creates a new fileNote instance
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
   * Get meta file dependencies - a note depends on _meta.md files in its
   * directory and all parent directories
   * @returns Array of meta file paths that this note depends on
   */
  getMetaDependencies(): string[] {
    const dependencies: string[] = [];
    const dirParts = path.dirname(this.relativePath).split('/');
    
    // Build path components for the current directory and all parent directories
    let currentPath = '';
    for (let i = 0; i < dirParts.length; i++) {
      if (dirParts[i]) {
        if (currentPath) {
          currentPath += '/';
        }
        currentPath += dirParts[i];
        
        // Add dependency on _meta.md in this directory
        const metaPath = `${currentPath}/_meta.md`;
        dependencies.push(metaPath);
      }
    }
    
    return dependencies;
  }

  /**
   * Get all dependencies for this note 
   * @returns Array of dependency paths
   */
  getDependencies(): string[] {
    // We don't combine these arrays here so the caller can distinguish types
    return this.getImageDependencies();
  }
  
  /**
   * Get asset dependencies specifically
   * @returns Array of asset dependencies
   */
  getAssetDependencies(): string[] {
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