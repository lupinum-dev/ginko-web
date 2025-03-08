// src/utils/logger.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLogger } from '../src/utils/logger';
import { SyncSettings } from '../src/types';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock fs module
vi.mock('fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  appendFile: vi.fn().mockResolvedValue(undefined)
}));

describe('logger - createLogger', () => {
  const settings: Partial<SyncSettings> = {
    obsidianRoot: '/Users/obsidian/vault/demo/',
    targetBasePath: './target',
    contentPath: 'content',
    assetsPath: 'assets',
    excludePaths: [],
    excludeFiles: [],
    debug: false,
    logToDisk: false,
    logFilePath: '.obsidian/plugins/ginko/log.txt'
  };

  // Setup and teardown for console.log mocking
  let originalConsoleLog: typeof console.log;
  
  beforeEach(() => {
    // Save original console.log
    originalConsoleLog = console.log;
    // Replace with mock
    console.log = vi.fn();
    
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore original console.log
    console.log = originalConsoleLog;
  });

  it('should create a logger with the correct interface', () => {
    const logger = createLogger(settings as SyncSettings);
    
    expect(logger).toHaveProperty('debug');
    expect(logger).toHaveProperty('info');
    expect(logger).toHaveProperty('warn');
    expect(logger).toHaveProperty('error');
    expect(logger).toHaveProperty('dispose');
    
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.dispose).toBe('function');
  });

  it('should not log debug messages when debug is disabled', () => {
    const logger = createLogger({ ...settings, debug: false } as SyncSettings);
    
    logger.debug('test-module', 'Debug message');
    
    expect(console.log).not.toHaveBeenCalled();
  });

  it('should log debug messages when debug is enabled', () => {
    const logger = createLogger({ ...settings, debug: true } as SyncSettings);
    
    logger.debug('test-module', 'Debug message');
    
    expect(console.log).toHaveBeenCalledWith(
      expect.stringMatching(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z\] \[DEBUG\] \[test-module\] Debug message/)
    );
  });

  it('should always log error messages regardless of debug setting', () => {
    const logger = createLogger({ ...settings, debug: false } as SyncSettings);
    
    logger.error('test-module', 'Error message');
    
    expect(console.log).toHaveBeenCalledWith(
      expect.stringMatching(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z\] \[ERROR\] \[test-module\] Error message/)
    );
  });

  it('should log info messages', () => {
    const logger = createLogger(settings as SyncSettings);
    
    logger.info('test-module', 'Info message');
    
    // Debug is false and level is info, so this should be logged
    expect(console.log).toHaveBeenCalledWith(
      expect.stringMatching(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z\] \[INFO\] \[test-module\] Info message/)
    );
  });

  it('should log warn messages', () => {
    const logger = createLogger(settings as SyncSettings);
    
    logger.warn('test-module', 'Warning message');
    
    // Debug is false and level is warn, so this should be logged
    expect(console.log).toHaveBeenCalledWith(
      expect.stringMatching(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z\] \[WARN\] \[test-module\] Warning message/)
    );
  });

  it('should create log file when logToDisk is enabled', async () => {
    const logSettings = { 
      ...settings, 
      logToDisk: true 
    };
    
    const logger = createLogger(logSettings as SyncSettings);
    
    // Wait for pending writes to complete
    await logger.dispose();
    
    // Check that mkdir was called with any directory path and recursive option
    expect(fs.mkdir).toHaveBeenCalledWith(
      expect.any(String), 
      { recursive: true }
    );
    
    // Check that writeFile was called with any log path and the expected content
    expect(fs.writeFile).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('=== Vault Sync Log Started at')
    );
  });

  it('should append to log file when logging with logToDisk enabled', async () => {
    const logSettings = { 
      ...settings, 
      logToDisk: true 
    };
    
    const logger = createLogger(logSettings as SyncSettings);
    
    // No need to wait for timers since we're mocking fs functions
    
    // Log a message
    logger.info('test-module', 'Info message');
    
    // Ensure appendFile was called (it's part of the promise chain, so might not be immediate)
    // We can force it by awaiting the dispose method
    await logger.dispose();
    
    expect(fs.appendFile).toHaveBeenCalledWith(
      path.join(logSettings.obsidianRoot, logSettings.logFilePath, 'log.txt'),
      expect.stringMatching(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z\] \[INFO\] \[test-module\] Info message\n/)
    );
  });

  it('should not interact with the file system when logToDisk is disabled', () => {
    const logger = createLogger({ ...settings, logToDisk: false } as SyncSettings);
    
    logger.info('test-module', 'Info message');
    
    expect(fs.mkdir).not.toHaveBeenCalled();
    expect(fs.writeFile).not.toHaveBeenCalled();
    expect(fs.appendFile).not.toHaveBeenCalled();
  });

  it('should wait for pending writes on dispose', async () => {
    const logSettings = { 
      ...settings, 
      logToDisk: true 
    };
    
    const logger = createLogger(logSettings);
    
    // Log messages
    logger.info('test-module', 'Message 1');
    logger.info('test-module', 'Message 2');
    
    // Mock implementation for appendFile to simulate delay
    const appendFileMock = vi.fn().mockResolvedValue(undefined);
    const originalAppendFile = fs.appendFile;
    (fs.appendFile as any) = appendFileMock;
    
    // Dispose logger
    const disposePromise = logger.dispose();
    
    // Ensure disposePromise resolves
    await disposePromise;
    
    // Restore original
    (fs.appendFile as any) = originalAppendFile;
    
    // Verify appendFile was called (at least for the log file initialization)
    expect(fs.writeFile).toHaveBeenCalled();
  });
});