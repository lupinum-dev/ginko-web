import type { DataAdapter } from 'obsidian'
import { promises as fs } from 'node:fs'

/**
 * Result of runtime/package manager detection
 */
export interface RuntimeCheckResult {
  valid: boolean
  runtime?: 'npm' | 'pnpm' | 'deno' | 'bun'
}

/**
 * Information about a website path
 */
export interface WebsitePathInfo {
  path: string
  status?: 'error' | 'warning' | 'valid'
  runtime?: string
}

/**
 * Normalizes a path to use forward slashes and removes trailing slashes
 */
export function normalizePath(inputPath: string): string {
  return inputPath.replace(/\\/g, '/').replace(/\/+$/, '')
}

/**
 * File paths for various runtime configurations
 */
const RUNTIME_CONFIG_FILES = {
  npm: ['package.json', 'package-lock.json'],
  pnpm: ['package.json', 'pnpm-lock.yaml'],
  deno: ['deno.json', 'deno.jsonc'],
  bun: ['package.json', 'bun.lockb'],
}

/**
 * Checks if a given path contains a website project and determines its runtime
 */
export async function checkWebsiteFolder(folderPath: string): Promise<RuntimeCheckResult> {
  try {
    const cleanPath = normalizePath(folderPath)

    // Check for npm/pnpm (needs package.json first)
    if (await fileExists(`${cleanPath}/package.json`)) {
      // Then determine which package manager
      if (await fileExists(`${cleanPath}/pnpm-lock.yaml`)) {
        return { valid: true, runtime: 'pnpm' }
      }
      if (await fileExists(`${cleanPath}/package-lock.json`)) {
        return { valid: true, runtime: 'npm' }
      }
      if (await fileExists(`${cleanPath}/bun.lockb`)) {
        return { valid: true, runtime: 'bun' }
      }

      // If no lock file found, default to npm
      return { valid: true, runtime: 'npm' }
    }

    // Check for Deno's configuration files
    if (await fileExists(`${cleanPath}/deno.json`) ||
      await fileExists(`${cleanPath}/deno.jsonc`)) {
      return { valid: true, runtime: 'deno' }
    }

    return { valid: false }
  }
  catch (error) {
    console.error('Error checking website folder:', error)
    return { valid: false }
  }
}

/**
 * Helper function to check if a file exists
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.stat(filePath)
    return true
  } catch {
    return false
  }
}

/**
 * Checks if a given path contains an Obsidian vault
 */
export async function checkVaultFolder(folderPath: string): Promise<boolean> {
  try {
    return await fileExists(`${folderPath}/.obsidian`)
  }
  catch (error) {
    console.error('Error checking vault folder:', error)
    return false
  }
}

/**
 * Gets the website path based on the current settings
 */
export async function getWebsitePath(
  adapter: DataAdapter,
  websitePathType: 'none' | 'standard' | 'custom',
  customPath?: string,
): Promise<WebsitePathInfo> {
  if (!websitePathType || websitePathType === 'none') {
    return { path: '<Not configured>', status: 'error' }
  }

  const websitePath = getPathFromSettings(adapter, websitePathType, customPath)

  // Check if the folder exists and contains required files
  const checkResult = await checkWebsiteFolder(websitePath)

  return {
    path: websitePath,
    status: checkResult.valid ? 'valid' : 'warning',
    runtime: checkResult.runtime,
  }
}

/**
 * Determines the website path based on the path type and custom path
 */
function getPathFromSettings(
  adapter: DataAdapter,
  pathType: 'standard' | 'custom',
  customPath?: string,
): string {
  const vaultPath = normalizePath((adapter as any).basePath || '')

  if (pathType === 'standard') {
    // For standard path, go up two levels from vault path
    const pathParts = vaultPath.split(/[/\\]/)
    return pathParts.slice(0, -2).join('/')
  }

  // For custom path
  if (!customPath) {
    return '<Not set>'
  }

  return normalizePath(customPath)
}