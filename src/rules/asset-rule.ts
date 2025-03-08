// src/rules/asset-rule.ts
import { FileEvent, Rule, TransformContext } from '../types';
import * as path from 'path';

/**
 * Creates a rule for handling asset files (images, attachments, etc.)
 * 
 * This rule transforms assets by placing them in the assets directory
 * while maintaining a simplified path structure
 * 
 * @returns Rule for handling asset files
 */
export const createAssetRule = (): Rule => {
  return {
    name: 'Asset Rule',
    
    shouldApply: (event: FileEvent, context: TransformContext): boolean => {
      // Apply to asset files or files in asset paths
      if (event.type === 'asset') {
        return true;
      }
      
      // Also match files in typical asset directories
      const normalizedPath = path.normalize(event.path).toLowerCase();
      return (
        normalizedPath.includes('/_assets/') || 
        normalizedPath.includes('/assets/') ||
        normalizedPath.includes('/attachments/')
      );
    },
    
    transform: (filePath: string, context: TransformContext): string => {
      // Extract the filename
      const filename = path.basename(filePath);
      
      // Create a simpler path structure for assets
      // First, remove leading slash if present
      const normalizedPath = filePath.startsWith('/') 
        ? filePath.substring(1) 
        : filePath;
      
      // Get the directory path without leading slash
      const dirPath = path.dirname(normalizedPath);
      
      // If the file is in an assets directory, simplify the path by removing 
      // the explicit 'assets', 'attachments', etc. part from the path
      let assetSubPath = dirPath;
      
      // Replace various asset directory patterns with empty string
      // to flatten the structure somewhat
      assetSubPath = assetSubPath
        .replace(/\b_?assets\b\/?/i, '')
        .replace(/\battachments\b\/?/i, '');
      
      // Remove any leading or trailing slashes from the subpath
      assetSubPath = assetSubPath.replace(/^\/+|\/+$/g, '');
      
      // Build the final target path
      return path.join(
        context.settings.targetBasePath,
        context.settings.assetsPath,
        assetSubPath,
        filename
      );
    }
  };
};