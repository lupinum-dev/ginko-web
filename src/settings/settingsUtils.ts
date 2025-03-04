import type { DataAdapter } from 'obsidian'
import { promises as fs } from 'node:fs'

export interface RuntimeCheckResult {
  valid: boolean
  runtime?: 'npm' | 'pnpm' | 'deno' | 'bun'
}

export interface WebsitePathInfo {
  path: string
  status?: 'error' | 'warning' | 'valid'
  runtime?: string
}

/**
 * Normalizes a path to use forward slashes and removes trailing slashes
 */
function normalizePath(inputPath: string): string {
  // Convert backslashes to forward slashes and remove trailing slashes
  return inputPath.replace(/\\/g, '/').replace(/\/+$/, '')
}

/**
 * Checks if a given path contains a website project and determines its runtime
 */
export async function checkWebsiteFolder(folderPath: string): Promise<RuntimeCheckResult> {
  try {
    // Remove any trailing slashes from the path and normalize
    const cleanPath = normalizePath(folderPath)

    // Check for package managers
    const packageJsonPath = `${cleanPath}/package.json`
    const pnpmLockPath = `${cleanPath}/pnpm-lock.yaml`
    const npmLockPath = `${cleanPath}/package-lock.json`

    // First check if package.json exists
    if (await fs.stat(packageJsonPath).catch(() => false)) {
      // Then determine which package manager
      if (await fs.stat(pnpmLockPath).catch(() => false)) {
        return { valid: true, runtime: 'pnpm' }
      }
      if (await fs.stat(npmLockPath).catch(() => false)) {
        return { valid: true, runtime: 'npm' }
      }
      // If no lock file found, default to npm
      return { valid: true, runtime: 'npm' }
    }

    // Check for Deno's configuration files
    const denoJsonPath = `${cleanPath}/deno.json`
    const denoJsoncPath = `${cleanPath}/deno.jsonc`

    if (
      await fs.stat(denoJsonPath).catch(() => false)
      || await fs.stat(denoJsoncPath).catch(() => false)
    ) {
      return { valid: true, runtime: 'deno' }
    }

    // Check for Bun's lock file
    const bunLockPath = `${cleanPath}/bun.lockb`

    if (await fs.stat(bunLockPath).catch(() => false)) {
      return { valid: true, runtime: 'bun' }
    }

    return { valid: false }
  }
  catch (error) {
    console.error('Error checking website folder:', error)
    return { valid: false }
  }
}

/**
 * Checks if a given path contains an Obsidian vault
 */
export async function checkVaultFolder(folderPath: string): Promise<boolean> {
  try {
    await fs.stat(`${folderPath}/.obsidian`)
    return true
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
  if (!websitePathType || websitePathType === 'none')
    return { path: '<Not configured>', status: 'error' }

  let websitePath: string
  const vaultPath = normalizePath((adapter as any).basePath || '')

  if (websitePathType === 'standard') {
    // For standard path, go up two levels from vault path
    const pathParts = vaultPath.split(/[/\\]/)
    websitePath = pathParts.slice(0, -2).join('/')
  }
  else {
    if (!customPath)
      return { path: '<Not set>', status: 'error' }

    websitePath = normalizePath(customPath)
  }

  // Check if the folder exists and contains required files
  const checkResult = await checkWebsiteFolder(websitePath)

  return {
    path: websitePath,
    status: checkResult.valid ? 'valid' : 'warning',
    runtime: checkResult.runtime,
  }
}
