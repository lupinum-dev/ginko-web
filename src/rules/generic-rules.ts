// src/rules/rule-functions.ts
import { FileEvent, PathTransform, Rule, TransformContext } from '../types';
import * as path from 'path';

// Base path transform
export const applyBasePath: PathTransform = (filePath, context) => {
  return path.join(context.settings.targetBasePath, filePath);
};

// Content path transform 
export const applyContentPath: PathTransform = (filePath, context) => {
  return path.join(context.settings.contentPath, filePath);
};

// Language transform
export const applyLanguage: PathTransform = (filePath, context) => {
  const fileName = path.basename(filePath);
  const dirPath = path.dirname(filePath);
  
  // Check for language pattern (filename__lang.ext)
  const match = fileName.match(/^(.+)__([a-z]{2,})(\..+)$/);
  if (match) {
    const [_, baseName, lang, ext] = match;
    return path.join(lang, dirPath, baseName + ext);
  }
  
  return filePath;
};

// Slug transform based on meta files
export const applyMetaSlug: PathTransform = (filePath, context) => {
  const dirPath = path.dirname(filePath);
  const fileName = path.basename(filePath);
  const dirParts = dirPath.split('/');
  
  // Look for meta information for each directory level
  for (let i = dirParts.length; i > 0; i--) {
    const checkPath = dirParts.slice(0, i).join('/');
    const meta = context.metaCache.get(checkPath);
    
    if (meta?.slug) {
      // Replace the directory with the slug
      dirParts[i-1] = meta.slug;
      return path.join(dirParts.join('/'), fileName);
    }
  }
  
  return path.join(dirPath, fileName);
};

// Asset transform - hash-based paths for assets
export const applyAssetTransform: PathTransform = (filePath, context) => {
  if (!filePath.includes('/_assets/')) return filePath;
  
  const fileName = path.basename(filePath);
  const ext = path.extname(fileName);
  const hash = createHash(filePath);
  
  return path.join(context.settings.assetsPath, `${hash}${ext}`);
};

// Helper function to create a hash from a string
function createHash(str: string): string {
  // In a real implementation, use a proper hash function
  // This is simplified for the example
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}

// Content transformation for replacing asset links
export function transformContent(content: string, assetMap: Map<string, string>): string {
  if (!content) return content;
  
  // Replace image links in markdown
  return content.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, imagePath) => {
    const newPath = assetMap.get(imagePath);
    return newPath ? `![${alt}](${newPath})` : match;
  });
}

// Parse meta content from string
export function parseMetaContent(content: string): any | null {
  try {
    const match = content.match(/^---\s*([\s\S]*?)\s*---/);
    if (!match) return null;
    
    const metaText = match[1];
    const meta: Record<string, any> = {};
    
    // Simple line-by-line parsing
    metaText.split('\n').forEach(line => {
      const colonPos = line.indexOf(':');
      if (colonPos > 0) {
        const key = line.substring(0, colonPos).trim();
        const value = line.substring(colonPos + 1).trim();
        meta[key] = value;
      }
    });
    
    return meta;
  } catch (error) {
    console.error('Error parsing meta content:', error);
    return null;
  }
}

// Create rule factories - functions that return rule objects
export function createBasePathRule(): Rule {
  return {
    name: 'base-path',
    shouldApply: () => true,
    transform: applyBasePath
  };
}

export function createContentPathRule(): Rule {
  return {
    name: 'content-path',
    shouldApply: (event) => event.type === 'markdown' || event.type === 'meta',
    transform: applyContentPath
  };
}

export function createLanguageRule(): Rule {
  return {
    name: 'language',
    shouldApply: (event) => event.type === 'markdown' && event.name.includes('__'),
    transform: applyLanguage
  };
}

export function createMetaSlugRule(): Rule {
  return {
    name: 'meta-slug',
    shouldApply: () => true,
    transform: applyMetaSlug
  };
}

export function createAssetRule(): Rule {
  return {
    name: 'asset',
    shouldApply: (event) => event.type === 'asset',
    transform: applyAssetTransform
  };
}