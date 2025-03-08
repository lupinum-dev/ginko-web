// src/core/rules-engine.ts
import { FileEvent, Rule, TransformContext } from '../types';

// Apply a sequence of rules to transform a path
export function applyRules(
  event: FileEvent, 
  rules: Rule[], 
  context: TransformContext
): string {
  let targetPath = event.path;
  
  // Apply each applicable rule in sequence
  for (const rule of rules) {
    if (rule.shouldApply(event, context)) {
      targetPath = rule.transform(targetPath, context);
    }
  }
  
  return targetPath;
}

// Update meta cache when a meta file changes
export function updateMetaCache(
  dirPath: string, 
  meta: any, 
  context: TransformContext
): TransformContext {
  // Create new context with updated cache (immutable approach)
  const newMetaCache = new Map(context.metaCache);
  newMetaCache.set(dirPath, meta);
  
  return {
    ...context,
    metaCache: newMetaCache
  };
}

// Add an asset mapping
export function updateAssetMap(
  sourcePath: string, 
  targetPath: string, 
  context: TransformContext
): TransformContext {
  // Create new asset map with the addition
  const newAssetMap = new Map(context.assetMap);
  newAssetMap.set(sourcePath, targetPath);
  
  return {
    ...context,
    assetMap: newAssetMap
  };
}

// Find paths affected by a slug change
export function findAffectedPaths(
  dirPath: string,
  pathMap: Map<string, string>
): string[] {
  return Array.from(pathMap.keys())
    .filter(sourcePath => sourcePath.startsWith(dirPath));
}

// Calculate new target path for an affected file
export function recalculateTargetPath(
  sourcePath: string,
  event: FileEvent,
  rules: Rule[],
  context: TransformContext
): string {
  // Create a new event for the source path
  const pathEvent: FileEvent = {
    ...event,
    path: sourcePath,
    name: sourcePath.split('/').pop() || '',
  };
  
  // Apply rules to get the new target path
  return applyRules(pathEvent, rules, context);
}