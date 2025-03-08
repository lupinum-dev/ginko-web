// src/adapters/file-system.ts
import { FileSystem } from '../types';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Logger } from '../utils/logger';

/**
 * Ensures a directory exists by creating it if necessary
 * Handles both absolute and relative paths properly
 */
async function ensureDirectoryExists(dirPath: string, logger?: Logger): Promise<void> {
  try {
    // Convert absolute paths to relative if they start with a slash and aren't Windows drive paths
    if (dirPath.startsWith('/') && !dirPath.match(/^[A-Za-z]:\//)) {
      logger?.debug('file-system.ts', `Converting absolute path to relative: ${dirPath}`);
      // Remove the leading slash to make it relative
      dirPath = dirPath.substring(1);
    }
    
    // Normalize path to handle .. and .
    const normalizedPath = path.normalize(dirPath);
    
    logger?.debug('file-system.ts', `Ensuring directory exists: ${normalizedPath}`);
    
    // Check if directory already exists
    try {
      await fs.access(normalizedPath);
      // If we get here, the directory exists
      logger?.debug('file-system.ts', `Directory already exists: ${normalizedPath}`);
      return;
    } catch {
      // Directory doesn't exist, proceed with creation
      logger?.debug('file-system.ts', `Directory does not exist, will create: ${normalizedPath}`);
    }
    
    // Use a more robust approach to create nested directories
    try {
      await fs.mkdir(normalizedPath, { recursive: true });
      logger?.debug('file-system.ts', `Successfully created directory tree: ${normalizedPath}`);
    } catch (error) {
      logger?.error('file-system.ts', `Failed during mkdir: ${normalizedPath}: ${error}`);
      throw error;
    }
  } catch (error) {
    logger?.error('file-system.ts', `Failed to ensure directory exists: ${dirPath}: ${error}`);
    throw error;
  }
}

/**
 * Normalize a path for our file system operations
 * Converts absolute paths to relative if needed
 */
function normalizePath(filePath: string, logger?: Logger): string {
  // Convert absolute paths to relative if they start with a slash and aren't Windows drive paths
  if (filePath.startsWith('/') && !filePath.match(/^[A-Za-z]:\//)) {
    logger?.debug('file-system.ts', `Converting absolute path to relative: ${filePath}`);
    // Remove the leading slash to make it relative
    filePath = filePath.substring(1);
  }
  
  return path.normalize(filePath);
}

/**
 * Create a Node.js file system implementation with optional logging
 */
export function createNodeFileSystem(logger?: Logger): FileSystem {
  return {
    readFile: async (filePath: string): Promise<string> => {
      try {
        const normalizedPath = normalizePath(filePath, logger);
        logger?.debug('file-system.ts', `Reading file: ${normalizedPath}`);
        const content = await fs.readFile(normalizedPath, 'utf-8');
        return content;
      } catch (error) {
        logger?.error('file-system.ts', `Error reading file ${filePath}: ${error}`);
        throw error;
      }
    },
    
    writeFile: async (filePath: string, content: string): Promise<void> => {
      try {
        const normalizedPath = normalizePath(filePath, logger);
        logger?.debug('file-system.ts', `Writing file: ${normalizedPath}`);
        // Ensure the directory exists first
        await ensureDirectoryExists(path.dirname(normalizedPath), logger);
        await fs.writeFile(normalizedPath, content, 'utf-8');
      } catch (error) {
        logger?.error('file-system.ts', `Error writing file ${filePath}: ${error}`);
        throw error;
      }
    },
    
    deleteFile: async (filePath: string): Promise<void> => {
      try {
        const normalizedPath = normalizePath(filePath, logger);
        logger?.debug('file-system.ts', `Deleting file: ${normalizedPath}`);
        await fs.unlink(normalizedPath);
      } catch (error) {
        logger?.error('file-system.ts', `Error deleting file ${filePath}: ${error}`);
        throw error;
      }
    },
    
    moveFile: async (oldPath: string, newPath: string): Promise<void> => {
      try {
        const normalizedOldPath = normalizePath(oldPath, logger);
        const normalizedNewPath = normalizePath(newPath, logger);
        logger?.debug('file-system.ts', `Moving file: ${normalizedOldPath} -> ${normalizedNewPath}`);
        // Ensure the target directory exists first
        await ensureDirectoryExists(path.dirname(normalizedNewPath), logger);
        await fs.rename(normalizedOldPath, normalizedNewPath);
      } catch (error) {
        logger?.error('file-system.ts', `Error moving file ${oldPath} to ${newPath}: ${error}`);
        throw error;
      }
    },
    
    createDirectory: async (dirPath: string): Promise<void> => {
      await ensureDirectoryExists(dirPath, logger);
    },
    
    exists: async (filePath: string): Promise<boolean> => {
      try {
        const normalizedPath = normalizePath(filePath, logger);
        await fs.access(normalizedPath);
        return true;
      } catch {
        return false;
      }
    }
  };
}

// For backward compatibility
export const nodeFileSystem = createNodeFileSystem();

/**
 * Create a mock file system for testing with optional logging
 */
export function createMockFileSystem(logger?: Logger): FileSystem {
  const files = new Map<string, string>();
  const directories = new Set<string>();
  
  // Helper to normalize paths in the mock system
  const normalizePathForMock = (filePath: string): string => {
    // Convert absolute paths to relative if they start with a slash
    if (filePath.startsWith('/') && !filePath.match(/^[A-Za-z]:\//)) {
      filePath = filePath.substring(1);
    }
    return path.normalize(filePath);
  };
  
  // Helper to check/create mock directories
  const ensureMockDirectoryExists = (dirPath: string): void => {
    const normalizedPath = normalizePathForMock(dirPath);
    
    // Skip if already exists
    if (directories.has(normalizedPath)) {
      return;
    }
    
    // Create parent directories first (recursive approach)
    const parent = path.dirname(normalizedPath);
    if (parent !== normalizedPath) {
      ensureMockDirectoryExists(parent);
    }
    
    // Add this directory
    directories.add(normalizedPath);
    logger?.debug('file-system.ts', `Mock: Created directory: ${normalizedPath}`);
  };
  
  return {
    readFile: async (filePath: string): Promise<string> => {
      const normalizedPath = normalizePathForMock(filePath);
      logger?.debug('file-system.ts', `Mock: Reading file: ${normalizedPath}`);
      const content = files.get(normalizedPath);
      if (content === undefined) {
        const error = new Error(`File not found: ${normalizedPath}`);
        logger?.error('file-system.ts', error.message);
        throw error;
      }
      return content;
    },
    
    writeFile: async (filePath: string, content: string): Promise<void> => {
      const normalizedPath = normalizePathForMock(filePath);
      logger?.debug('file-system.ts', `Mock: Writing file: ${normalizedPath}`);
      // Ensure directory exists in mock system
      ensureMockDirectoryExists(path.dirname(normalizedPath));
      files.set(normalizedPath, content);
    },
    
    deleteFile: async (filePath: string): Promise<void> => {
      const normalizedPath = normalizePathForMock(filePath);
      logger?.debug('file-system.ts', `Mock: Deleting file: ${normalizedPath}`);
      if (!files.has(normalizedPath)) {
        const error = new Error(`File not found: ${normalizedPath}`);
        logger?.error('file-system.ts', error.message);
        throw error;
      }
      files.delete(normalizedPath);
    },
    
    moveFile: async (oldPath: string, newPath: string): Promise<void> => {
      const normalizedOldPath = normalizePathForMock(oldPath);
      const normalizedNewPath = normalizePathForMock(newPath);
      logger?.debug('file-system.ts', `Mock: Moving file: ${normalizedOldPath} -> ${normalizedNewPath}`);
      const content = files.get(normalizedOldPath);
      if (content === undefined) {
        const error = new Error(`File not found: ${normalizedOldPath}`);
        logger?.error('file-system.ts', error.message);
        throw error;
      }
      
      // Ensure directory exists for the new path
      ensureMockDirectoryExists(path.dirname(normalizedNewPath));
      
      files.set(normalizedNewPath, content);
      files.delete(normalizedOldPath);
    },
    
    createDirectory: async (dirPath: string): Promise<void> => {
      const normalizedPath = normalizePathForMock(dirPath);
      logger?.debug('file-system.ts', `Mock: Creating directory: ${normalizedPath}`);
      ensureMockDirectoryExists(normalizedPath);
    },
    
    exists: async (filePath: string): Promise<boolean> => {
      const normalizedPath = normalizePathForMock(filePath);
      // Check both files and directories
      const exists = files.has(normalizedPath) || directories.has(normalizedPath);
      logger?.debug('file-system.ts', `Mock: Checking if exists: ${normalizedPath} - ${exists}`);
      return exists;
    }
  };
}