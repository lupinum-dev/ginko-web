// src/utils/logger.ts
import { SyncSettings } from '../types';
import * as fs from 'fs/promises';
import * as path from 'path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  source: string;
  message: string;
}

export class Logger {
  private settings: SyncSettings;
  private logBuffer: LogEntry[] = [];
  private logPath: string;
  private flushInterval: NodeJS.Timeout | null = null;
  
  constructor(settings: SyncSettings) {
    this.settings = settings;
    this.logPath = path.join(settings.targetBasePath, 'sync.log');
    
    // Set up log flushing if log to disk is enabled
    if (settings.logToDisk) {
      this.flushInterval = setInterval(() => this.flushLogs(), 30000); // Flush every 30 seconds
    }
  }
  
  log(level: LogLevel, source: string, message: string): void {
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      source,
      message
    };
    
    // Add to buffer
    this.logBuffer.push(entry);
    
    // Log to console if debug is enabled or level is higher than debug
    if (this.settings.debug || level !== 'debug') {
      const formattedMessage = this.formatLogEntry(entry);
      
      switch (level) {
        case 'debug':
        case 'info':
          console.log(formattedMessage);
          break;
        case 'warn':
          console.warn(formattedMessage);
          break;
        case 'error':
          console.error(formattedMessage);
          break;
      }
    }
  }
  
  // Helper methods for each log level
  debug(source: string, message: string): void {
    this.log('debug', source, message);
  }
  
  info(source: string, message: string): void {
    this.log('info', source, message);
  }
  
  warn(source: string, message: string): void {
    this.log('warn', source, message);
  }
  
  error(source: string, message: string): void {
    this.log('error', source, message);
  }
  
  // Format a log entry for display
  private formatLogEntry(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    return `[${timestamp}] [${entry.level.toUpperCase()}] [${entry.source}] ${entry.message}`;
  }
  
  // Flush logs to disk
  async flushLogs(): Promise<void> {
    if (!this.settings.logToDisk || this.logBuffer.length === 0) {
      return;
    }
    
    try {
      // Ensure directory exists
      await fs.mkdir(path.dirname(this.logPath), { recursive: true });
      
      // Format logs
      const logContent = this.logBuffer
        .map(entry => this.formatLogEntry(entry))
        .join('\n') + '\n';
      
      // Append to file
      await fs.appendFile(this.logPath, logContent, 'utf-8');
      
      // Clear buffer
      this.logBuffer = [];
    } catch (error) {
      console.error(`Failed to write logs to disk: ${error}`);
    }
  }
  
  // Clean up
  dispose(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    
    // Flush any remaining logs
    this.flushLogs().catch(err => {
      console.error(`Failed to flush logs on dispose: ${err}`);
    });
  }
}