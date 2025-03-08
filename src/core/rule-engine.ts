// src/core/rule-engine.ts
import { FileEvent, Rule, TransformContext } from '../types';
import * as path from 'path';

/**
 * Apply all rules that should apply to an event
 */
export function applyRules(
  event: FileEvent,
  rules: Rule[],
  context: TransformContext
): string {
  let resultPath = event.path;
  
  for (const rule of rules) {
    if (rule.shouldApply(event, context)) {
      resultPath = rule.transform(resultPath, context);
    }
  }
  
  // Ensure the path is absolute and using correct directory separators
  const absolutePath = path.isAbsolute(resultPath) 
    ? resultPath 
    : path.resolve(path.normalize(resultPath));
    
  return absolutePath;
}

/**
 * Find all paths that start with a given directory path
 */
export function findAffectedPaths(
  dirPath: string,
  pathMap: Map<string, string>
): string[] {
  const normalizedDirPath = path.normalize(dirPath);
  
  return Array.from(pathMap.keys()).filter(sourcePath => {
    return path.normalize(sourcePath).startsWith(normalizedDirPath);
  });
}

/**
 * Recalculate a target path using the rules
 */
export function recalculateTargetPath(
  sourcePath: string,
  event: FileEvent,
  rules: Rule[],
  context: TransformContext
): string {
  const modifiedEvent: FileEvent = {
    ...event,
    path: sourcePath
  };
  
  return applyRules(modifiedEvent, rules, context);
}

/**
 * Update the meta cache with new metadata
 */
export function updateMetaCache(
  dirPath: string,
  meta: any,
  context: TransformContext
): TransformContext {
  const newMetaCache = new Map(context.metaCache);
  newMetaCache.set(dirPath, meta);
  
  return {
    ...context,
    metaCache: newMetaCache
  };
}

/**
 * Update the asset map with a new mapping
 */
export function updateAssetMap(
  sourcePath: string,
  targetPath: string,
  context: TransformContext
): TransformContext {
  const newAssetMap = new Map(context.assetMap);
  newAssetMap.set(sourcePath, targetPath);
  
  return {
    ...context,
    assetMap: newAssetMap
  };
}