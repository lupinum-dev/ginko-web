import { File } from './file';

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
   * Extract image references from markdown content
   * @returns Array of image paths referenced in the note
   */
  getImageDependencies(): string[] {
    // Match Markdown image syntax: ![alt text](image-path)
    const imageRegex = /!\[.*?\]\((.*?)\)/g;
    const matches = [...this.content.matchAll(imageRegex)];
    
    // Normalize paths by removing leading slash
    return matches.map(match => match[1].replace(/^\//, '')); 
  }

  /**
   * Get all dependencies for this note 
   * (Currently only images, but could be extended for other types)
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