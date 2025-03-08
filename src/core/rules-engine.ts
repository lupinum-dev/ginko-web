// src/rules/index.ts
import { Rule } from '../types';
import { createMarkdownRule } from '../rules/markdown-rule';
import { createAssetRule } from '../rules/asset-rule';

import { createLocalizedMarkdownRule } from '../rules/localized-markdown-rule';

/**
 * Creates all rules for the sync engine in the correct order of priority
 * 
 * @param options Optional settings to customize rule behavior
 * @returns Array of rules in order of evaluation priority
 */
export const createSyncRules = (options?: {
  enableLocalizedMarkdown?: boolean;
  excludePatterns?: string[];
}): Rule[] => {
  const rules: Rule[] = [];
  
  // Add metadata rule (should be evaluated first)
  // rules.push(createMetadataRule());
  
  // Add localized markdown rule if enabled
  if (options?.enableLocalizedMarkdown !== false) {
    rules.push(createLocalizedMarkdownRule());
  }
  
  // Add standard markdown rule
  rules.push(createMarkdownRule());
  
  // Add asset rule
  rules.push(createAssetRule());
  
  return rules;
};

// Re-export individual rule creators for direct use
export { createMarkdownRule } from '../rules/markdown-rule';
export { createAssetRule } from '../rules/asset-rule';
export { createLocalizedMarkdownRule } from '../rules/localized-markdown-rule';