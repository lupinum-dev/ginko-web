// src/rules/markdown-rule.ts
import { FileEvent, Rule, TransformContext } from '../types';
import * as path from 'path';

/**
 * Creates a rule for handling standard markdown files
 * 
 * This rule transforms markdown files by placing them in the content directory
 * while preserving their relative path from the vault root
 * 
 * @returns Rule for handling markdown files
 */
export const createMarkdownRule = (): Rule => {
  return {
    name: 'Markdown Rule',
    
    shouldApply: (event: FileEvent, context: TransformContext): boolean => {
      // Apply to all markdown files that aren't already handled by more specific rules
      return event.type === 'markdown';
    },
    
    transform: (filePath: string, context: TransformContext): string => {
      // Get the path relative to the vault root
      const relativePath = filePath.startsWith('/') 
        ? filePath.substring(1) // Remove leading slash
        : filePath;
      
      // Build the target path within the content directory
      return path.join(
        context.settings.targetBasePath,
        context.settings.contentPath,
        relativePath
      );
    }
  };
};