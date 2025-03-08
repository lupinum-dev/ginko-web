// src/adapters/file-system.ts
import { FileSystem } from '../types';
import * as fs from 'fs/promises';
import * as path from 'path';

// Node.js file system implementation
export const nodeFileSystem: FileSystem = {
  readFile: async (filePath: string): Promise<string> => {
    return fs.readFile(filePath, 'utf-8');
  },
  
  writeFile: async (filePath: string, content: string): Promise<void> => {
    await fs.writeFile(filePath, content, 'utf-8');
  },
  
  deleteFile: async (filePath: string): Promise<void> => {
    await fs.unlink(filePath);
  },
  
  moveFile: async (oldPath: string, newPath: string): Promise<void> => {
    await fs.rename(oldPath, newPath);
  },
  
  createDirectory: async (dirPath: string): Promise<void> => {
    await fs.mkdir(dirPath, { recursive: true });
  },
  
  exists: async (filePath: string): Promise<boolean> => {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
};

// Mock file system for testing
export function createMockFileSystem(): FileSystem {
  const files = new Map<string, string>();
  
  return {
    readFile: async (filePath: string): Promise<string> => {
      const content = files.get(filePath);
      if (content === undefined) {
        throw new Error(`File not found: ${filePath}`);
      }
      return content;
    },
    
    writeFile: async (filePath: string, content: string): Promise<void> => {
      files.set(filePath, content);
    },
    
    deleteFile: async (filePath: string): Promise<void> => {
      if (!files.has(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }
      files.delete(filePath);
    },
    
    moveFile: async (oldPath: string, newPath: string): Promise<void> => {
      const content = files.get(oldPath);
      if (content === undefined) {
        throw new Error(`File not found: ${oldPath}`);
      }
      files.set(newPath, content);
      files.delete(oldPath);
    },
    
    createDirectory: async (dirPath: string): Promise<void> => {
      // Directories are implicit in this mock
    },
    
    exists: async (filePath: string): Promise<boolean> => {
      return files.has(filePath);
    }
  };
}