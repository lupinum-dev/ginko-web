// src/rules/asset-rule.ts
import { FileEvent, Rule, TransformContext } from '../types';
import * as path from 'path';

/**
 * Creates a rule for handling asset files (images, attachments, etc.)
 * 
 * This rule transforms assets by placing them in the assets directory
 * while maintaining a simplified path structure. Assets are stored
 * in a central location for easier management.
 * 
 * @returns Rule for handling asset files
 */
export const createAssetRule = (): Rule => {
  // Create a local cache to avoid duplicate work
  const pathCache = new Map<string, string>();

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
      // Check if we have this path in the cache from previous operations
      if (pathCache.has(filePath)) {
        return pathCache.get(filePath)!;
      }
      
      // Check if we already know the target path from a previous run (persistence)
      if (context.metaCache.has(filePath)) {
        return context.metaCache.get(filePath);
      }
      
      // Extract the filename
      const filename = path.basename(filePath);
      
      // For assets, we'll store them all in a central assets directory
      // regardless of their original location, simplifying the structure
      
      // Build the final target path - store all assets in the root of the assets directory
      const targetPath = path.join(
        context.settings.targetBasePath,
        context.settings.assetsPath,
        filename
      );
      
      // Store in our local cache for this session
      pathCache.set(filePath, targetPath);
      
      // Store the path mapping in the metaCache for future use and for tests
      if (context.metaCache instanceof Map) {
        const metaCache = context.metaCache as Map<string, string>;
        metaCache.set(filePath, targetPath);
      }
      
      return targetPath;
    }
  };
};