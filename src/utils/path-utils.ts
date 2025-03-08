// Normalize the settings path and make the path relative by removing the obsidian root root folder if is part of the folder
// make sure we also handle the case where the user can use "../.." to provide a relative path to the target base path

import { Logger } from '../types';

export const normalizeTargetPath = (path: string, obsidianRoot: string, logger?: Logger): string => {
  // Convert backslashes to forward slashes and normalize multiple slashes
  const normalizedPath = path.replace(/\\/g, '/').replace(/\/+/g, '/');
  const normalizedRoot = obsidianRoot.replace(/\\/g, '/').replace(/\/+/g, '/');

  // If the path starts with a Windows drive letter, treat it as absolute
  if (/^[A-Za-z]:/i.test(normalizedPath)) {
    if (!normalizedPath.includes('..')) {
      return normalizedPath;
    }
    // For Windows paths with "..", we need to handle them specially
    const driveLetter = normalizedPath.slice(0, 2);
    const pathWithoutDrive = normalizedPath.slice(2);
    const rootWithoutDrive = normalizedRoot.slice(2);
    const result = handleRelativePath(pathWithoutDrive, rootWithoutDrive);
    return `${driveLetter}${result}`;
  }

  // If the path is absolute, return it normalized
  if (normalizedPath.startsWith('/')) {
    return normalizedPath;
  }

  return handleRelativePath(normalizedPath, normalizedRoot);
};

export const normalizeSettingsPath = (inputPath: string, logger?: Logger): string => {
  // Handle empty or root path
  if (!inputPath || inputPath === '/') {
    return './';
  }

  // Convert backslashes to forward slashes and normalize multiple slashes
  let normalizedPath = inputPath.replace(/\\/g, '/').replace(/\/+/g, '/');

  // Remove Windows drive letter if present
  normalizedPath = normalizedPath.replace(/^[A-Za-z]:/, '');

  // Remove leading slash
  normalizedPath = normalizedPath.replace(/^\//, '');

  // Remove "./" from the beginning and normalize path
  normalizedPath = normalizedPath.replace(/^\.\//, '');

  // Resolve parent directory references
  const parts = normalizedPath.split('/');
  const resolvedParts = [];
  for (const part of parts) {
    if (part === '.' || part === '') continue;
    if (part === '..') {
      resolvedParts.pop();
    } else {
      resolvedParts.push(part);
    }
  }

  // Return joined path without trailing slash
  return resolvedParts.length > 0 ? resolvedParts.join('/') : './';
};

function handleRelativePath(normalizedPath: string, normalizedRoot: string): string {
  // Clean up the path by removing unnecessary "./" segments while preserving structure
  const cleanPath = normalizedPath.replace(/\/\.\//g, '/');
  const pathParts = cleanPath.split('/').filter(part => part !== '.');
  const rootParts = normalizedRoot.split('/');

  // Handle relative paths with "../" references
  if (cleanPath.includes('..')) {
    let upCount = 0;
    while (pathParts[0] === '..') {
      upCount++;
      pathParts.shift();
    }

    // Remove the appropriate number of segments from the root path
    rootParts.splice(-upCount);

    // Combine the remaining root parts with the remaining path parts
    return [...rootParts, ...pathParts].join('/');
  }

  // For simple relative paths, just join with the root
  return `${normalizedRoot}/${pathParts.join('/')}`;
}