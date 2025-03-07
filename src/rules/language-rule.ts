// src/rules/language-rule.ts
import { Rule, SyncEvent, RuleContext } from '../types';
import * as path from 'path';

/**
 * Rule that handles language-specific files
 * Example: note__de.md -> content/de/note.md
 * 
 * Dynamically detects any language code in the format "filename__lang.md"
 */
export class LanguageRule implements Rule {
  name = 'language';
  priority = 50; // Medium priority
  
  constructor() {}
  
  shouldApply(event: SyncEvent): boolean {
    // Apply to files with language suffixes
    if (event.type !== 'markdown') {
      return false;
    }
    
    // Check for language suffix pattern (filename__lang.md)
    return /^.+__[a-zA-Z0-9_-]+\.md$/.test(event.name);
  }
  
  apply(event: SyncEvent, context: RuleContext): SyncEvent {
    const { targetBasePath, contentPath, debug } = context;
    
    // Extract language code from filename using regex
    const match = event.name.match(/^(.+)__([a-zA-Z0-9_-]+)\.md$/);
    
    if (match) {
      const [_, baseFileName, langCode] = match;
      
      // Avoid path manipulation if the path already has been processed
      // by checking if it already includes the target path
      if (event.path.includes(targetBasePath)) {
        return event;
      }
      
      const dirPath = path.dirname(event.path);
      
      // Create new target path with language folder
      // We set this as a complete path so it won't be processed by the generic rule
      const targetPath = path.join(
        targetBasePath,
        contentPath,
        langCode, // Use detected language code
        dirPath,
        `${baseFileName}.md` // Filename without the language suffix
      );
      
      if (debug) {
        console.log(`LanguageRule: ${event.path} -> ${targetPath} (detected language: ${langCode})`);
      }
      
      return {
        ...event,
        path: targetPath
      };
    }
    
    // No language match found, return unchanged
    return event;
  }
}