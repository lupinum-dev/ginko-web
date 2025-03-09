
import { describe, it, expect } from 'vitest';
import { createAssetRule } from '../../src/rules/asset-rule';
import { FileEvent, SyncSettings, TransformContext } from '../../src/types';

// TODO: I want to test my rules in a easy integration test, you are allowed to change everything, what is needed to make this possible!
// TODO2: You can check the tests, in the test folder, and run 'pnpm test' to see the tests, if they fail you can rewrite them aslong as we keep functionalality
// THE MOST IMPORTANT THING FOR ME IS SO THAT I CAN TEST MY IMPLEMENTATION IN THE FOLLOWING WAY!

describe('', () => {
  // Setup
  // We only provide the required settings with Partial, so it doesnt get in the way
  const defaultSettings: Partial<SyncSettings> = {
    obsidianRoot: '/obsidian',
    targetBasePathUser: './target',
    targetBasePath: './target',
  };

  // FOR LATER: (There is no need to implement this) Here we define our meta cache items, can be empty or have items
 
  const metaCache = [] // Map

  // FOR LATER: (There is no need to implement this) Here we define our asset cache items, can be empty or have items
  const assetCache = [] // Map

  // State before we process the files
  const filesSource = ['a.md', 'b__de.md'] // Arrays of files from the source
  const filesTarget = [] // Arrays of files from the target

  // Here we define the applied rules
  const rules = [markdownRule, assetRule] // Array of rules

  const eventBatches = [[
    {
        "name": "a.md",
        "path": "a.md",
        "type": "markdown",
        "action": "create",
        "timestamp": 1741498953213,
        "content": "a"
    },
    {
        "name": "b__de.md",
        "path": "A/b__de.md",
        "type": "markdown",
        "action": "create",
        "timestamp": 1741498953213,
        "content": "b"
    }
]] // Array of event batches

  // Then we do the processing

  // After processing we should check the files in the target
  const filesTargetAfter = ['content/a.md', 'content/b__de.md'] // Arrays of files from the target


  // We can also check the meta cache
  const metaCacheAfter = [] // Map

  // And the asset cache
  const assetCacheAfter = [] // Map

  // and compare them to the required state

  const requiredFilesTargetAfter = ['content/a.md', 'content/b__de.md'] // Arrays of files from the target
  const requiredMetaCacheAfter = [] // Map
  const requiredAssetCacheAfter = [] // Map
  
}