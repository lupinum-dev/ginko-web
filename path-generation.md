# Ginko Web Path Generation System

## Overview

The path generation system in Ginko Web is responsible for managing file paths across different frameworks, ensuring content is properly organized in the target website structure. It handles path resolution, validation, and framework-specific configurations.

## Framework-Specific Path Configurations

### Nuxt Paths
```typescript
// src/processor/configs/nuxt/paths.ts
export const nuxtPaths = {
  content: 'content',
  meta: 'content',
  assets: 'assets',
  galleries: 'public/galleries',
} as const

export type NuxtPathKey = keyof typeof nuxtPaths
```

### Astro Paths
```typescript
// src/processor/configs/astro/paths.ts
export const astroPaths = {
  content: 'src/content',
  meta: 'src/content/meta',
  assets: 'src/assets',
  galleries: 'src/public/galleries',
} as const

export type AstroPathKey = keyof typeof astroPaths
```

These constants define the standard directory structure for each supported framework, allowing for consistent path generation based on the selected template.

## FileSystemService

The `FileSystemService` class handles path operations and file system interactions:

```typescript
export class FileSystemService {
  // Path resolution and validation
  async exists(filePath: string): Promise<boolean>
  
  // Directory creation with path validation
  async ensureDir(dirPath: string): Promise<void>
  
  // Asset path generation with unique identifiers
  public async getAssetOutputPath(
    sourcePath: string
  ): Promise<{ outputRelativePath: string, uid: string }>
  
  // Output directory management
  async resetOutputDirectory(): Promise<void>
  
  // File operations with path handling
  async readFile(filePath: string): Promise<Buffer>
  async writeFile(filePath: string, data: string | Buffer): Promise<void>
  async copyFile(sourcePath: string, targetPath: string): Promise<void>
  async deleteFile(filePath: string): Promise<void>
}
```

## Path Generation Mechanisms

### Asset Path Generation

Assets receive unique identifiers to prevent caching issues:

```typescript
private async generateFileUid(sourcePath: string): Promise<string> {
  const settings = this.getSettings()

  if (!settings.paths.vaultPath) {
    throw new Error('Vault path is not configured')
  }

  const fullPath = path.join(settings.paths.vaultPath, sourcePath)
  const content = await this.readFile(fullPath)
  return crypto.createHash('md5').update(content).digest('hex')
}

public async getAssetOutputPath(
  sourcePath: string
): Promise<{ outputRelativePath: string, uid: string }> {
  const ext = path.extname(sourcePath)
  const uid = await this.generateFileUid(sourcePath)
  return {
    outputRelativePath: path.join('public', '_assets', `${uid}${ext}`),
    uid,
  }
}
```

### Directory Management

The system ensures directories exist before writing files:

```typescript
async ensureDir(dirPath: string): Promise<void> {
  try {
    if (dirPath === '/' || dirPath === '\\.cache') {
      throw new Error(
        `Invalid directory path: ${dirPath}. Must be a relative or project path.`
      )
    }
    await fs.mkdir(dirPath, { recursive: true })
  }
  catch (error) {
    throw this.wrapError('ensureDir', dirPath, undefined, error)
  }
}
```

### Output Directory Reset

For rebuilds, the system can reset specific output directories:

```typescript
async resetOutputDirectory(): Promise<void> {
  const settings = this.getSettings()
  if (!settings.paths.websitePath) {
    throw new Error('Website path is not configured')
  }
  const dirPath = settings.paths.websitePath

  try {
    // Define paths to clean
    const pathsToDelete = [
      path.join(dirPath, 'content'),
      path.join(dirPath, 'public', '_assets'),
    ]

    // Delete only specific directories
    for (const pathToDelete of pathsToDelete) {
      if (await this.exists(pathToDelete)) {
        await fs.rm(pathToDelete, { recursive: true, force: true })
        // Recreate the empty directory
        await fs.mkdir(pathToDelete, { recursive: true })
      }
    }
  }
  catch (error) {
    console.error('Error resetting output directories:', error)
    throw new Error(`Failed to reset output directories: ${error.message}`)
  }
}
```

## Path Validation

The settings system includes path validation:

```typescript
export function validatePathConfiguration(
  settings: GinkoWebSettings, 
  hasPackageManager: boolean
): PathValidationStatus {
  const status = {
    isValid: false,
    hasPackageManager,
    message: 'Please configure your website path',
  }

  // First check if we have a valid type selected
  if (settings.paths.type === 'none') {
    settings.paths.pathConfigured = false
    status.message = 'Please select a website location'
    return status
  }

  // For standard path, check if package manager is detected
  if (settings.paths.type === 'standard') {
    status.isValid = hasPackageManager
    status.message = hasPackageManager
      ? '✓ Configuration valid - Ready to use Ginko'
      : '⚠ Website folder found but no package manager detected'

    settings.paths.pathConfigured = status.isValid
    return status
  }

  // For custom path, validate configuration
  // ...
}
```

## Error Handling

Path operations include error handling to provide meaningful messages:

```typescript
private wrapError(
  operation: string, 
  sourcePath: string, 
  targetPath: string | undefined, 
  error: unknown
): Error {
  const message = targetPath
    ? `Failed to ${operation} from ${sourcePath} to ${targetPath}`
    : `Failed to ${operation} ${sourcePath}`
  return error instanceof Error ? error : new Error(`${message}: ${error}`)
}
```

## Examples of Path Generation in Action

1. **Asset Processing**: 
   - Input file: `images/logo.png`
   - Generated output: `public/_assets/{md5-hash}.png`

2. **Markdown Content**:
   - Input file: `docs/guide.md`
   - For Nuxt: `content/guide.md`
   - For Astro: `src/content/guide.md`

3. **Gallery Images**:
   - Input directory: `gallery/vacation`
   - For Nuxt: `public/galleries/vacation`
   - For Astro: `src/public/galleries/vacation`