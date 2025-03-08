import { expect, test, describe } from 'vitest';
import { normalizeTargetPath, normalizeSettingsPath } from '../src/utils/path-utils';
import * as path from 'path';

describe('NormalizeTargetPath', () => {
  test('should handle basic path normalization', () => {
    const result = normalizeTargetPath('/Users/Dev/Git/target', '/Users/Dev/Git/2025/ginko-web');
    expect(result).toBe('/Users/Dev/Git/target');
  });

  test('should handle paths with "../" references', () => {
    const result = normalizeTargetPath('../../target', '/Users/Dev/Git/2025/ginko-web');
    expect(result).toBe('/Users/Dev/Git/target');
  });

  test('should handle relative paths ', () => {
    const result = normalizeTargetPath('A/target', '/Users/Dev/Git/2025/ginko-web');
    expect(result).toBe('/Users/Dev/Git/2025/ginko-web/A/target');
  });

  // Windows-style paths
  test('should handle Windows-style absolute paths', () => {
    const result = normalizeTargetPath('C:\\Users\\Dev\\Git\\target', 'C:\\Users\\Dev\\Git\\2025\\ginko-web');
    expect(result).toBe('C:/Users/Dev/Git/target');
  });

  test('should handle Windows-style relative paths', () => {
    const result = normalizeTargetPath('..\\..\\target', 'C:\\Users\\Dev\\Git\\2025\\ginko-web');
    expect(result).toBe('C:/Users/Dev/Git/target');
  });

  // Mixed path styles
  test('should handle mixed forward and back slashes', () => {
    const result = normalizeTargetPath('C:\\Users/Dev\\Git/target', '/Users/Dev/Git/2025/ginko-web');
    expect(result).toBe('C:/Users/Dev/Git/target');
  });

  // Edge cases
  test('should handle multiple consecutive path separators', () => {
    const result = normalizeTargetPath('A//B///target', '/Users/Dev/Git/2025/ginko-web');
    expect(result).toBe('/Users/Dev/Git/2025/ginko-web/A/B/target');
  });

  test('should handle multiple "../" sequences', () => {
    const result = normalizeTargetPath('../../../target', '/Users/Dev/Git/2025/ginko-web/subfolder');
    expect(result).toBe('/Users/Dev/Git/target');
  });

  test('should handle "./" in paths', () => {
    const result = normalizeTargetPath('./target/./subfolder', '/Users/Dev/Git/2025/ginko-web');
    expect(result).toBe('/Users/Dev/Git/2025/ginko-web/target/subfolder');
  });
});

describe('NormalizeSettingsPath', () => {
  // Unix/Linux style paths
  test('should handle Unix absolute path', () => {
    const result = normalizeSettingsPath('/content');
    expect(result).toBe('content');
  });

  test('should handle Unix relative path', () => {
    const result = normalizeSettingsPath('content');
    expect(result).toBe('content');
  });

  test('should handle Unix nested path', () => {
    const result = normalizeSettingsPath('/content/a');
    expect(result).toBe('content/a');
  });

  test('should handle Unix path with dot', () => {
    const result = normalizeSettingsPath('./content/a/');
    expect(result).toBe('content/a');
  });

  // Windows style paths
  test('should handle Windows absolute path', () => {
    const result = normalizeSettingsPath('C:\\content');
    expect(result).toBe('content');
  });

  test('should handle Windows nested path', () => {
    const result = normalizeSettingsPath('C:\\content\\subfolder');
    expect(result).toBe('content/subfolder');
  });

  test('should handle Windows path with dot', () => {
    const result = normalizeSettingsPath('.\\content\\subfolder\\');
    expect(result).toBe('content/subfolder');
  });

  // Mixed path styles
  test('should handle mixed slashes', () => {
    const result = normalizeSettingsPath('content\\subfolder/nested');
    expect(result).toBe('content/subfolder/nested');
  });

  // Edge cases
  test('should handle multiple consecutive slashes', () => {
    const result = normalizeSettingsPath('content//subfolder///nested');
    expect(result).toBe('content/subfolder/nested');
  });

  test('should handle dots in path', () => {
    const result = normalizeSettingsPath('./content/./subfolder');
    expect(result).toBe('content/subfolder');
  });

  test('should handle parent directory references', () => {
    const result = normalizeSettingsPath('content/parent/../subfolder');
    expect(result).toBe('content/subfolder');
  });

  test('should handle empty or root path', () => {
    expect(normalizeSettingsPath('')).toBe('./');
    expect(normalizeSettingsPath('/')).toBe('./');
  });

  test('should handle paths with trailing dot', () => {
    const result = normalizeSettingsPath('content/subfolder/.');
    expect(result).toBe('content/subfolder');
  });

  test('should handle paths with special characters', () => {
    const result = normalizeSettingsPath('content/sub folder/test-dir');
    expect(result).toBe('content/sub folder/test-dir');
  });
});

describe('Path Joins', () => {
  test('should handle path joins', () => {
    const result = path.join('content', 'sub folder', 'test-dir');
    expect(result).toBe('content/sub folder/test-dir');
  });
});

describe('Path Integration Tests', () => {
  test('should join normalized target path with settings path', () => {
    const targetPath = normalizeTargetPath('/Users/Dev/Git/target', '/Users/Dev/Git/2025/ginko-web');
    const settingsPath = normalizeSettingsPath('content/notes');
    const result = path.join(targetPath, settingsPath);
    expect(result).toBe('/Users/Dev/Git/target/content/notes');
  });

  test('should join normalized paths with Windows-style inputs', () => {
    const targetPath = normalizeTargetPath('C:\\Users\\Dev\\Git\\target', 'C:\\Users\\Dev\\Git\\2025\\ginko-web');
    const settingsPath = normalizeSettingsPath('C:\\content\\notes');
    const result = path.join(targetPath, settingsPath);
    expect(result).toBe('C:/Users/Dev/Git/target/content/notes');
  });

  test('should handle relative paths in joins', () => {
    const targetPath = normalizeTargetPath('../../target', '/Users/Dev/Git/2025/ginko-web');
    const settingsPath = normalizeSettingsPath('./content/notes');
    const result = path.join(targetPath, settingsPath);
    expect(result).toBe('/Users/Dev/Git/target/content/notes');
  });

  test('should handle mixed path styles in joins', () => {
    const targetPath = normalizeTargetPath('C:\\Users/Dev\\Git/target', '/Users/Dev/Git/2025/ginko-web');
    const settingsPath = normalizeSettingsPath('content\\notes/subfolder');
    const result = path.join(targetPath, settingsPath);
    expect(result).toBe('C:/Users/Dev/Git/target/content/notes/subfolder');
  });

  test('should handle special characters in joined paths', () => {
    const targetPath = normalizeTargetPath('/Users/Dev/Git/my project', '/Users/Dev/Git/2025/ginko-web');
    const settingsPath = normalizeSettingsPath('content/special chars/test-dir');
    const result = path.join(targetPath, settingsPath);
    expect(result).toBe('/Users/Dev/Git/my project/content/special chars/test-dir');
  });

  test('should handle parent directory references in joined paths', () => {
    const targetPath = normalizeTargetPath('/Users/Dev/Git/target', '/Users/Dev/Git/2025/ginko-web');
    const settingsPath = normalizeSettingsPath('content/../notes/./subfolder');
    const result = path.join(targetPath, settingsPath);
    expect(result).toBe('/Users/Dev/Git/target/notes/subfolder');
  });

  test('should handle empty or root paths in joins', () => {
    const targetPath = normalizeTargetPath('/Users/Dev/Git/target', '/Users/Dev/Git/2025/ginko-web');
    const settingsPath = normalizeSettingsPath('');
    const result = path.join(targetPath, settingsPath).replace(/\/$/, '');
    expect(result).toBe('/Users/Dev/Git/target');
  });

  test('should handle multiple path segments in joins', () => {
    const targetPath = normalizeTargetPath('/Users/Dev/Git/target', '/Users/Dev/Git/2025/ginko-web');
    const settingsPath1 = normalizeSettingsPath('content');
    const settingsPath2 = normalizeSettingsPath('notes');
    const settingsPath3 = normalizeSettingsPath('subfolder');
    const result = path.join(targetPath, settingsPath1, settingsPath2, settingsPath3);
    expect(result).toBe('/Users/Dev/Git/target/content/notes/subfolder');
  });
});
