// src/rules/localized-markdown-rule.ts
import { FileEvent, Rule, TransformContext } from '../types';
import * as path from 'path';

/**
 * Creates a rule for handling markdown files with language suffixes
 * Example: /folder/file1__de.md -> {targetBasePath}/{contentPath}/de/folder/file1.md
 * 
 * This rule organizes localized markdown files into language-specific subdirectories
 * while removing the language suffix from the filename
 * 
 * @returns Rule for handling localized markdown files
 */
export const createLocalizedMarkdownRule = (): Rule => {
  return {
    name: 'Localized Markdown Rule',
    
    shouldApply: (event: FileEvent, context: TransformContext): boolean => {
      // Only apply to markdown files
      if (event.type !== 'markdown') {
        return false;
      }
      
      // Check if the filename matches the pattern: name__lang.md
      const filename = path.basename(event.path);
      return /^.+__[a-z]{2}\.md$/.test(filename);
    },
    
    transformPath: (filePath: string, context: TransformContext): string => {
      // Extract filename and directory
      const dirname = path.dirname(filePath);
      const filename = path.basename(filePath);
      
      // Extract language code from the filename
      const match = filename.match(/__([a-z]{2})\.md$/);
      if (!match || !match[1]) {
        throw new Error(`Failed to extract language code from ${filename}`);
      }
      
      const langCode = match[1];
      
      // Remove the __LANG suffix from the filename
      const baseFilename = filename.replace(`__${langCode}.md`, '.md');
      
      // Construct the path relative to the root, removing leading slash if present
      const relativePath = dirname === '/' ? '' : dirname.replace(/^\//, '');
      
      // Build the target path
      return path.join(
        context.settings.targetBasePath,
        context.settings.contentPath,
        langCode,
        relativePath,
        baseFilename
      );
    }
  };
};

/**
 * Creates a rule for handling markdown files with specific language suffix
 * Example: /folder/file1__de.md -> {targetBasePath}/{contentPath}/de/folder/file1.md
 * 
 * This rule is a more specific version that only handles a single language
 * 
 * @param languageCode The specific language code to handle (e.g. 'de')
 * @returns Rule for handling localized markdown files for a specific language
 */
export const createLanguageSpecificRule = (languageCode: string): Rule => {
  return {
    name: `${languageCode.toUpperCase()} Language Rule`,
    
    shouldApply: (event: FileEvent, context: TransformContext): boolean => {
      // Only apply to markdown files
      if (event.type !== 'markdown') {
        return false;
      }
      
      // Check if the filename matches the pattern: name__specificLang.md
      const filename = path.basename(event.path);
      return filename.endsWith(`__${languageCode}.md`);
    },
    
    transformPath: (filePath: string, context: TransformContext): string => {
      // Extract filename and directory
      const dirname = path.dirname(filePath);
      const filename = path.basename(filePath);
      
      // Remove the __LANG suffix from the filename
      const baseFilename = filename.replace(`__${languageCode}.md`, '.md');
      
      // Construct the path relative to the root, removing leading slash if present
      const relativePath = dirname === '/' ? '' : dirname.replace(/^\//, '');
      
      // Build the target path
      return path.join(
        context.settings.targetBasePath,
        context.settings.contentPath,
        languageCode,
        relativePath,
        baseFilename
      );
    }
  };
};