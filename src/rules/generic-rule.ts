// src/rules/generic-rule.ts
import { Rule, SyncEvent, RuleContext } from '../types';
import * as path from 'path';

/**
 * Generic rule that simply moves files to the target directory
 * maintaining their original structure.
 */
export class GenericRule implements Rule {
  name = 'generic';
  priority = 0; // Lowest priority, runs last
  
  constructor() {}
  
  shouldApply(event: SyncEvent): boolean {
    // This is a catch-all rule, applies to everything
    return true;
  }
  
  apply(event: SyncEvent, context: RuleContext): SyncEvent {
    const { targetBasePath, contentPath, debug } = context;
    
    // If the path already contains the target base path, don't modify it further
    // This prevents duplicate paths when multiple rules are applied
    if (event.path.includes(targetBasePath)) {
      if (debug) {
        console.log(`GenericRule: Path already contains target base, skipping: ${event.path}`);
      }
      return event;
    }
    
    // For the generic rule, we simply preserve the path structure
    // but place it under the target content directory
    const targetPath = path.join(targetBasePath, contentPath, event.path);
    
    if (debug) {
      console.log(`GenericRule: ${event.path} -> ${targetPath}`);
    }
    
    return {
      ...event,
      path: targetPath
    };
  }
}