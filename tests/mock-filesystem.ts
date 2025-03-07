// tests/mock-filesystem.ts
import { FileSystem } from '../src/types';
import path from 'path';

export class MockFileSystem implements FileSystem {
  private files: Map<string, string> = new Map();
  private directories: Set<string> = new Set();
  
  constructor() {
    // Initialize with root directory
    this.directories.add('/');
  }
  
  // Reset the mock filesystem
  reset(): void {
    this.files.clear();
    this.directories.clear();
    this.directories.add('/');
  }

  // Get all files in the mock filesystem
  getAllFiles(): Record<string, string> {
    return Object.fromEntries(this.files.entries());
  }

  // Get all directories in the mock filesystem
  getAllDirectories(): string[] {
    return Array.from(this.directories);
  }

  // Helper to normalize paths
  private normalizePath(filePath: string): string {
    // Ensure path starts with /
    if (!filePath.startsWith('/')) {
      filePath = '/' + filePath;
    }
    
    // Remove any double slashes and normalize
    return path.normalize(filePath).replace(/\/\//g, '/');
  }

  // Check if a file exists
  hasFile(filePath: string): boolean {
    const normalizedPath = this.normalizePath(filePath);
    return this.files.has(normalizedPath);
  }

  // Check if a directory exists
  hasDirectory(dirPath: string): boolean {
    const normalizedPath = this.normalizePath(dirPath);
    return this.directories.has(normalizedPath);
  }

  // Get file content if exists
  getFileContent(filePath: string): string | null {
    const normalizedPath = this.normalizePath(filePath);
    return this.files.get(normalizedPath) || null;
  }

  // Debug function to print all files and directories
  printAll(): void {
    console.log('Files:');
    this.files.forEach((content, path) => {
      console.log(`- ${path}`);
    });
    
    console.log('Directories:');
    this.directories.forEach(dir => {
      console.log(`- ${dir}`);
    });
  }

  // Implementation of FileSystem interface
  async mkdir(dirPath: string, options?: { recursive: boolean }): Promise<void> {
    const normalizedPath = this.normalizePath(dirPath);
    
    if (options?.recursive) {
      // Create parent directories recursively
      let currentPath = '';
      const segments = normalizedPath.split('/').filter(segment => segment);
      
      for (const segment of segments) {
        currentPath = currentPath ? `${currentPath}/${segment}` : `/${segment}`;
        this.directories.add(currentPath);
      }
    } else {
      // Just create this directory
      this.directories.add(normalizedPath);
    }
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    const normalizedPath = this.normalizePath(filePath);
    
    // Ensure directory exists
    const dirPath = path.dirname(normalizedPath);
    if (!this.directories.has(dirPath)) {
      await this.mkdir(dirPath, { recursive: true });
    }
    
    this.files.set(normalizedPath, content);
  }

  async readFile(filePath: string): Promise<string> {
    const normalizedPath = this.normalizePath(filePath);
    const content = this.files.get(normalizedPath);
    
    if (content === undefined) {
      throw new Error(`File not found: ${normalizedPath}`);
    }
    
    return content;
  }

  async rm(filePath: string, options?: { recursive: boolean, force: boolean }): Promise<void> {
    const normalizedPath = this.normalizePath(filePath);
    
    if (this.files.has(normalizedPath)) {
      this.files.delete(normalizedPath);
    } else if (options?.recursive && this.directories.has(normalizedPath)) {
      // Delete directory and all contained files
      this.directories.delete(normalizedPath);
      
      // Delete files that start with this directory path
      for (const file of this.files.keys()) {
        if (file.startsWith(`${normalizedPath}/`)) {
          this.files.delete(file);
        }
      }
      
      // Delete subdirectories
      for (const dir of this.directories) {
        if (dir.startsWith(`${normalizedPath}/`)) {
          this.directories.delete(dir);
        }
      }
    } else if (!options?.force) {
      throw new Error(`Path not found: ${normalizedPath}`);
    }
  }

  async access(filePath: string): Promise<boolean> {
    const normalizedPath = this.normalizePath(filePath);
    return this.files.has(normalizedPath) || this.directories.has(normalizedPath);
  }
}