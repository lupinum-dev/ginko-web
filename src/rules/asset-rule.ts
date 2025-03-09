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
    

    transformPath: (filePath: string, context: TransformContext): string => {


      // Extract the filename
      const filename = path.basename(filePath);                
      // Build the final target path - store all assets in the root of the assets directory
      const targetPath = path.join(
        context.settings.targetBasePath,
        context.settings.assetsPath,
        filename
      );
      

      

      return targetPath;
    },

    transformContent: (content: string, context: TransformContext): string => {
      return content;
    }
  };
};