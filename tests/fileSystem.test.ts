// src/utils/file-system.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockFileSystem } from '../src/utils/file-system';
import { Logger } from '../src/types';
import * as path from 'path';

// Mock logger for testing
const createMockLogger = (): Logger => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  dispose: vi.fn().mockResolvedValue(undefined)
});

describe('file-system - createMockFileSystem', () => {
  let mockLogger: Logger;
  let mockFs: ReturnType<typeof createMockFileSystem>;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockFs = createMockFileSystem(mockLogger);
  });

  it('should write and read files correctly', async () => {
    const testPath = 'test/file.txt';
    const testContent = 'Hello, world!';

    // Write file
    await mockFs.writeFile(testPath, testContent);
    
    // Check directory creation was logged
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'file-system',
      expect.stringContaining('Mock: Created directory: test')
    );
    
    // Check file writing was logged
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'file-system',
      expect.stringContaining(`Mock: Writing file: ${path.normalize(testPath)}`)
    );
    
    // Read file
    const content = await mockFs.readFile(testPath);
    
    // Check file reading was logged
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'file-system',
      expect.stringContaining(`Mock: Reading file: ${path.normalize(testPath)}`)
    );
    
    expect(content).toBe(testContent);
  });

  it('should handle file deletion correctly', async () => {
    const testPath = 'test/file.txt';
    const testContent = 'Hello, world!';

    // Write file
    await mockFs.writeFile(testPath, testContent);
    
    // Delete file
    await mockFs.deleteFile(testPath);
    
    // Check file deletion was logged
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'file-system',
      expect.stringContaining(`Mock: Deleting file: ${path.normalize(testPath)}`)
    );
    
    // Check file no longer exists
    const exists = await mockFs.exists(testPath);
    expect(exists).toBe(false);
  });

  it('should handle file move operations correctly', async () => {
    const oldPath = 'test/original.txt';
    const newPath = 'test/new/moved.txt';
    const testContent = 'Hello, world!';

    // Write file
    await mockFs.writeFile(oldPath, testContent);
    
    // Move file
    await mockFs.moveFile(oldPath, newPath);
    
    // Check move operation was logged
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'file-system',
      expect.stringContaining(`Mock: Moving file: ${path.normalize(oldPath)} -> ${path.normalize(newPath)}`)
    );
    
    // Check target directory was created
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'file-system',
      expect.stringContaining(`Mock: Created directory: ${path.normalize('test/new')}`)
    );
    
    // Check original file no longer exists
    const originalExists = await mockFs.exists(oldPath);
    expect(originalExists).toBe(false);
    
    // Check new file exists with correct content
    const newExists = await mockFs.exists(newPath);
    expect(newExists).toBe(true);
    
    const content = await mockFs.readFile(newPath);
    expect(content).toBe(testContent);
  });

  it('should create directories correctly', async () => {
    const dirPath = 'test/nested/dir';
    
    // Create directory
    await mockFs.createDirectory(dirPath);
    
    // Check directory creation was logged
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'file-system',
      expect.stringContaining(`Mock: Creating directory: ${path.normalize(dirPath)}`)
    );
    
    // Check parent directories were created
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'file-system',
      expect.stringContaining(`Mock: Created directory: ${path.normalize('test')}`)
    );
    
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'file-system',
      expect.stringContaining(`Mock: Created directory: ${path.normalize('test/nested')}`)
    );
    
    // Check directory exists
    const exists = await mockFs.exists(dirPath);
    expect(exists).toBe(true);
  });

  it('should handle path normalization correctly', async () => {
    // Paths with leading slashes should be normalized
    const testPath = '/test/file.txt';
    const testContent = 'Hello, world!';
    
    // Write file
    await mockFs.writeFile(testPath, testContent);
    
    // Check file was written with normalized path
    const normalizedPath = path.normalize(testPath.substring(1));
    
    // Read with normalized path
    const content = await mockFs.readFile(normalizedPath);
    expect(content).toBe(testContent);
    
    // Read with original path
    const contentWithOriginalPath = await mockFs.readFile(testPath);
    expect(contentWithOriginalPath).toBe(testContent);
  });

  it('should throw error when reading non-existent files', async () => {
    const nonExistentFile = 'does/not/exist.txt';
    
    await expect(mockFs.readFile(nonExistentFile)).rejects.toThrow('File not found');
    
    expect(mockLogger.error).toHaveBeenCalledWith(
      'file-system',
      expect.stringContaining(`File not found: ${path.normalize(nonExistentFile)}`)
    );
  });

  it('should throw error when deleting non-existent files', async () => {
    const nonExistentFile = 'does/not/exist.txt';
    
    await expect(mockFs.deleteFile(nonExistentFile)).rejects.toThrow('File not found');
    
    expect(mockLogger.error).toHaveBeenCalledWith(
      'file-system',
      expect.stringContaining(`File not found: ${path.normalize(nonExistentFile)}`)
    );
  });

  it('should throw error when moving non-existent files', async () => {
    const nonExistentFile = 'does/not/exist.txt';
    const targetPath = 'target/path.txt';
    
    await expect(mockFs.moveFile(nonExistentFile, targetPath)).rejects.toThrow('File not found');
    
    expect(mockLogger.error).toHaveBeenCalledWith(
      'file-system',
      expect.stringContaining(`File not found: ${path.normalize(nonExistentFile)}`)
    );
  });

  it('should handle exists check correctly', async () => {
    // Empty file system should not have any files
    let exists = await mockFs.exists('any/path.txt');
    expect(exists).toBe(false);
    
    // Create a file
    const testPath = 'test/file.txt';
    await mockFs.writeFile(testPath, 'content');
    
    // File should exist
    exists = await mockFs.exists(testPath);
    expect(exists).toBe(true);
    
    // Parent directory should exist
    exists = await mockFs.exists('test');
    expect(exists).toBe(true);
    
    // Non-existent file in existing directory should not exist
    exists = await mockFs.exists('test/other.txt');
    expect(exists).toBe(false);
    
    // Check that exists calls are logged
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'file-system',
      expect.stringContaining(`Mock: Checking if exists: ${path.normalize(testPath)} - true`)
    );
    
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'file-system',
      expect.stringContaining(`Mock: Checking if exists: ${path.normalize('test/other.txt')} - false`)
    );
  });
});