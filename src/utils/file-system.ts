// src/utils/file-system.ts
import { FileSystem, Logger } from '../types';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Normalizes a path for file operations
 */
const normalizePath = (filePath: string, logger?: Logger): string => {
  // Convert absolute paths to relative if they start with a slash and aren't Windows drive paths
  if (filePath.startsWith('/') && !filePath.match(/^[A-Za-z]:\//)) {
    logger?.debug('file-system', `Converting absolute path to relative: ${filePath}`);
    // Remove the leading slash to make it relative
    filePath = filePath.substring(1);
  }
  
  return path.normalize(filePath);
};

/**
 * Ensures a directory exists, creating it if needed
 */
const ensureDirectoryExists = async (
  dirPath: string, 
  logger?: Logger
): Promise<void> => {
  try {
    const normalizedPath = normalizePath(dirPath, logger);
    logger?.debug('file-system', `Ensuring directory exists: ${normalizedPath}`);
    
    // Check if directory already exists
    try {
      await fs.access(normalizedPath);
      logger?.debug('file-system', `Directory already exists: ${normalizedPath}`);
      return;
    } catch {
      // Directory doesn't exist, proceed with creation
      logger?.debug('file-system', `Directory does not exist, will create: ${normalizedPath}`);
    }
    
    // Create directory
    await fs.mkdir(normalizedPath, { recursive: true });
    logger?.debug('file-system', `Successfully created directory tree: ${normalizedPath}`);
  } catch (error) {
    logger?.error('file-system', `Failed to ensure directory exists: ${dirPath}: ${error}`);
    throw error;
  }
};

/**
 * Creates a file system implementation for real file operations
 */
export const createFileSystem = (logger?: Logger): FileSystem => ({
  readFile: async (filePath: string): Promise<string> => {
    try {
      const normalizedPath = normalizePath(filePath, logger);
      logger?.debug('file-system', `Reading file: ${normalizedPath}`);
      return await fs.readFile(normalizedPath, 'utf-8');
    } catch (error) {
      logger?.error('file-system', `Error reading file ${filePath}: ${error}`);
      throw error;
    }
  },
  
  writeFile: async (filePath: string, content: string): Promise<void> => {
    try {
      const normalizedPath = normalizePath(filePath, logger);
      logger?.debug('file-system', `Writing file: ${normalizedPath}`);
      
      // Ensure the directory exists first
      await ensureDirectoryExists(path.dirname(normalizedPath), logger);
      await fs.writeFile(normalizedPath, content, 'utf-8');
    } catch (error) {
      logger?.error('file-system', `Error writing file ${filePath}: ${error}`);
      throw error;
    }
  },
  
  deleteFile: async (filePath: string): Promise<void> => {
    try {
      const normalizedPath = normalizePath(filePath, logger);
      logger?.debug('file-system', `Deleting file: ${normalizedPath}`);
      await fs.unlink(normalizedPath);
    } catch (error) {
      logger?.error('file-system', `Error deleting file ${filePath}: ${error}`);
      throw error;
    }
  },
  
  moveFile: async (oldPath: string, newPath: string): Promise<void> => {
    try {
      const normalizedOldPath = normalizePath(oldPath, logger);
      const normalizedNewPath = normalizePath(newPath, logger);
      logger?.debug('file-system', `Moving file: ${normalizedOldPath} -> ${normalizedNewPath}`);
      
      // Ensure the target directory exists first
      await ensureDirectoryExists(path.dirname(normalizedNewPath), logger);
      await fs.rename(normalizedOldPath, normalizedNewPath);
    } catch (error) {
      logger?.error('file-system', `Error moving file ${oldPath} to ${newPath}: ${error}`);
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
});

/**
 * Creates a mock file system for testing
 */
export const createMockFileSystem = (logger?: Logger): FileSystem => {
  // Using immutable maps for file system state
  let files = new Map<string, string>();
  let directories = new Set<string>();
  
  // Normalize paths for the mock system
  const normalizePathForMock = (filePath: string): string => {
    if (filePath.startsWith('/') && !filePath.match(/^[A-Za-z]:\//)) {
      filePath = filePath.substring(1);
    }
    return path.normalize(filePath);
  };
  
  // Ensure a mock directory exists
  const ensureMockDirectoryExists = (dirPath: string): void => {
    const normalizedPath = normalizePathForMock(dirPath);
    
    // Skip if already exists
    if (directories.has(normalizedPath)) {
      return;
    }
    
    // Create parent directories first
    const parent = path.dirname(normalizedPath);
    if (parent !== normalizedPath) {
      ensureMockDirectoryExists(parent);
    }
    
    // Add this directory (immutably)
    directories = new Set([...directories, normalizedPath]);
    logger?.debug('file-system', `Mock: Created directory: ${normalizedPath}`);
  };
  
  return {
    readFile: async (filePath: string): Promise<string> => {
      const normalizedPath = normalizePathForMock(filePath);
      logger?.debug('file-system', `Mock: Reading file: ${normalizedPath}`);
      
      const content = files.get(normalizedPath);
      if (content === undefined) {
        const error = new Error(`File not found: ${normalizedPath}`);
        logger?.error('file-system', error.message);
        throw error;
      }
      
      return content;
    },
    
    writeFile: async (filePath: string, content: string): Promise<void> => {
      const normalizedPath = normalizePathForMock(filePath);
      logger?.debug('file-system', `Mock: Writing file: ${normalizedPath}`);
      
      // Ensure directory exists in mock system
      ensureMockDirectoryExists(path.dirname(normalizedPath));
      
      // Update files map immutably
      files = new Map(files);
      files.set(normalizedPath, content);
    },
    
    deleteFile: async (filePath: string): Promise<void> => {
      const normalizedPath = normalizePathForMock(filePath);
      logger?.debug('file-system', `Mock: Deleting file: ${normalizedPath}`);
      
      if (!files.has(normalizedPath)) {
        const error = new Error(`File not found: ${normalizedPath}`);
        logger?.error('file-system', error.message);
        throw error;
      }
      
      // Update files map immutably
      files = new Map(files);
      files.delete(normalizedPath);
    },
    
    moveFile: async (oldPath: string, newPath: string): Promise<void> => {
      const normalizedOldPath = normalizePathForMock(oldPath);
      const normalizedNewPath = normalizePathForMock(newPath);
      logger?.debug('file-system', `Mock: Moving file: ${normalizedOldPath} -> ${normalizedNewPath}`);
      
      const content = files.get(normalizedOldPath);
      if (content === undefined) {
        const error = new Error(`File not found: ${normalizedOldPath}`);
        logger?.error('file-system', error.message);
        throw error;
      }
      
      // Ensure directory exists for the new path
      ensureMockDirectoryExists(path.dirname(normalizedNewPath));
      
      // Update files map immutably
      files = new Map(files);
      files.set(normalizedNewPath, content);
      files.delete(normalizedOldPath);
    },
    
    createDirectory: async (dirPath: string): Promise<void> => {
      const normalizedPath = normalizePathForMock(dirPath);
      logger?.debug('file-system', `Mock: Creating directory: ${normalizedPath}`);
      ensureMockDirectoryExists(normalizedPath);
    },
    
    exists: async (filePath: string): Promise<boolean> => {
      const normalizedPath = normalizePathForMock(filePath);
      const exists = files.has(normalizedPath) || directories.has(normalizedPath);
      logger?.debug('file-system', `Mock: Checking if exists: ${normalizedPath} - ${exists}`);
      return exists;
    }
  };
};