// src/utils/logger.ts
import { Logger, LogLevel, SyncSettings } from '../types';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Creates a timestamp string for log messages
 */
const getTimestamp = (): string => new Date().toISOString();

/**
 * Formats a log message with timestamp, level, and module
 */
const formatLogMessage = (level: LogLevel, module: string, message: string): string =>
  `[${getTimestamp()}] [${level.toUpperCase()}] [${module}] ${message}`;

/**
 * Creates a logger function for a specific log level
 */
const createLoggerForLevel = (
  level: LogLevel,
  shouldLog: boolean,
  logToConsole: (message: string) => void,
  logToFile: (message: string) => Promise<void>
) => (module: string, message: string): void => {
  if (!shouldLog) return;
  
  const formattedMessage = formatLogMessage(level, module, message);
  logToConsole(formattedMessage);
  
  // Don't await the file write to avoid blocking
  logToFile(formattedMessage).catch(err => {
    console.error(`Failed to write to log file: ${err}`);
  });
};

/**
 * Creates a logger instance based on the provided settings
 */
export const createLogger = (settings: SyncSettings): Logger => {
  // Set up logging to file if enabled
  let logFile: string | null = null;
  let pendingWrites: Promise<void> = Promise.resolve();
  
  // Initialize log file if needed
  if (settings.logToDisk) {
    logFile = path.join(settings.targetBasePath, 'sync-log.txt');
    
    // Create initial log file header
    const header = `=== Vault Sync Log Started at ${getTimestamp()} ===\n`;
    pendingWrites = fs.mkdir(path.dirname(logFile), { recursive: true })
      .then(() => fs.writeFile(logFile!, header));
  }
  
  // Function to append to log file, managing async queue
  const appendToLogFile = (message: string): Promise<void> => {
    if (!logFile) return Promise.resolve();
    
    // Chain the write to previous pending writes
    pendingWrites = pendingWrites
      .then(() => fs.appendFile(logFile!, message + '\n'))
      .catch(err => console.error(`Failed to write to log file: ${err}`));
    
    return pendingWrites;
  };
  
  // Function for console output that logs all levels except debug when debug is disabled
  const logToConsole = (level: LogLevel) => (message: string): void => {
    if (level !== 'debug' || settings.debug) {
      console.log(message);
    }
  };
  
  // Create logger functions for each level
  return {
    debug: createLoggerForLevel('debug', settings.debug, logToConsole('debug'), appendToLogFile),
    info: createLoggerForLevel('info', true, logToConsole('info'), appendToLogFile),
    warn: createLoggerForLevel('warn', true, logToConsole('warn'), appendToLogFile),
    error: createLoggerForLevel('error', true, logToConsole('error'), appendToLogFile),
    dispose: async (): Promise<void> => {
      // Wait for any pending writes to complete
      return pendingWrites;
    }
  };
};