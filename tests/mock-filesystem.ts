// tests/mock-filesystem.ts
import { FileSystem } from '../src/types';
import * as path from 'path';

interface MockFile {
  content: string;
  isDirectory: boolean;
}

export class MockFileSystem implements FileSystem {
  // In-memory file system
  private files: Map<string, MockFile> = new Map();
  
  // For testing: Get the current state of files
  getFiles(): Map<string, MockFile> {
    return new Map(this.files);
  }
  
  // Clear all files (for test setup)
  clear(): void {
    this.files.clear();
  }
  
  // Create a directory
  async mkdir(dirPath: string, options?: { recursive: boolean }): Promise<void> {
    const recursive = options?.recursive || false;
    
    // Normalize path
    const normalizedPath = this.normalizePath(dirPath);
    
    // Check if the path exists and is a directory
    if (this.files.has(normalizedPath)) {
      const file = this.files.get(normalizedPath)!;
      if (!file.isDirectory) {
        throw new Error(`Path exists but is not a directory: ${normalizedPath}`);
      }
      return; // Directory already exists
    }
    
    // If recursive, create parent directories
    if (recursive) {
      const parentPath = path.dirname(normalizedPath);
      if (parentPath !== normalizedPath && parentPath !== '.') {
        await this.mkdir(parentPath, { recursive: true });
      }
    } else {
      // Check if parent directory exists
      const parentPath = path.dirname(normalizedPath);
      if (parentPath !== normalizedPath && parentPath !== '.') {
        const parentExists = this.files.has(parentPath);
        if (!parentExists) {
          throw new Error(`Parent directory does not exist: ${parentPath}`);
        }
      }
    }
    
    // Create the directory
    this.files.set(normalizedPath, { content: '', isDirectory: true });
  }
  
  // Write a file
  async writeFile(filePath: string, content: string, encoding?: string): Promise<void> {
    const normalizedPath = this.normalizePath(filePath);
    
    // Create parent directories
    const dirPath = path.dirname(normalizedPath);
    if (dirPath !== normalizedPath) {
      await this.mkdir(dirPath, { recursive: true });
    }
    
    // Write the file
    this.files.set(normalizedPath, { content, isDirectory: false });
  }
  
  // Read a file
  async readFile(filePath: string, encoding?: string): Promise<string> {
    const normalizedPath = this.normalizePath(filePath);
    
    // Check if the file exists
    if (!this.files.has(normalizedPath)) {
      throw new Error(`File does not exist: ${normalizedPath}`);
    }
    
    const file = this.files.get(normalizedPath)!;
    if (file.isDirectory) {
      throw new Error(`Cannot read directory as file: ${normalizedPath}`);
    }
    
    return file.content;
  }
  
  // Remove a file or directory
  async rm(filePath: string, options?: { recursive: boolean, force: boolean }): Promise<void> {
    const normalizedPath = this.normalizePath(filePath);
    const recursive = options?.recursive || false;
    const force = options?.force || false;
    
    // Check if the path exists
    if (!this.files.has(normalizedPath)) {
      if (force) {
        return; // Ignore if file doesn't exist and force is true
      }
      throw new Error(`Path does not exist: ${normalizedPath}`);
    }
    
    const file = this.files.get(normalizedPath)!;
    
    // If directory, check if it's empty or recursive is true
    if (file.isDirectory) {
      // Get all children
      const children: string[] = [];
      for (const path of this.files.keys()) {
        if (path !== normalizedPath && path.startsWith(normalizedPath + '/')) {
          children.push(path);
        }
      }
      
      if (children.length > 0) {
        if (!recursive) {
          throw new Error(`Directory is not empty: ${normalizedPath}`);
        }
        
        // Remove all children
        for (const childPath of children) {
          this.files.delete(childPath);
        }
      }
    }
    
    // Remove the file or directory
    this.files.delete(normalizedPath);
  }
  
  // Check if a file or directory exists
  async access(filePath: string): Promise<boolean> {
    const normalizedPath = this.normalizePath(filePath);
    return this.files.has(normalizedPath);
  }
  
  // Helper: Normalize a path
  private normalizePath(filePath: string): string {
    // Remove leading ./ if present
    let normalized = filePath.startsWith('./') ? filePath.substring(2) : filePath;
    
    // Remove trailing / if present
    normalized = normalized.endsWith('/') ? normalized.substring(0, normalized.length - 1) : normalized;
    
    return normalized;
  }
}