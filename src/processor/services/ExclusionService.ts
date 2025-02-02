import type { TAbstractFile } from 'obsidian'
import type GinkoWebPlugin from '../../main'
import { TFile } from 'obsidian'
import { DEFAULT_SETTINGS, ensureSettingsInitialized } from '../../settings/settingsTypes'

export class ExclusionService {
  private includedFolders: Set<string>
  private ignoredFiles: Set<string>

  constructor(private plugin: GinkoWebPlugin) {
    this.includedFolders = new Set()
    this.ignoredFiles = new Set()
    this.loadSettings()
  }

  private loadSettings() {
    // Ensure settings exist and are initialized
    const settings = this.plugin.settings ?? DEFAULT_SETTINGS
    const initializedSettings = ensureSettingsInitialized(settings)

    // Load and normalize inclusions
    const includedFolders = initializedSettings.inclusions.includedFolders
      .split(',')
      .map(p => p.trim())
      .filter(p => p.length > 0)
      .map(p => p.startsWith('/') ? p.slice(1) : p) // Remove leading slashes
    this.includedFolders = new Set(includedFolders)

    // Load and normalize file exclusions
    const ignoredFiles = initializedSettings.exclusions.ignoredFiles
      .split(',')
      .map(p => p.trim())
      .filter(p => p.length > 0)
      .map(p => p.startsWith('/') ? p.slice(1) : p) // Remove leading slashes
    this.ignoredFiles = new Set(ignoredFiles)
  }

  /**
   * Checks if a path is a parent of another path
   * @param parent The potential parent path
   * @param child The potential child path
   * @returns true if parent is a parent path of child
   */
  private isParentPath(parent: string, child: string): boolean {
    // Normalize paths by removing leading/trailing slashes
    const normalizedParent = parent.replace(/^\/+|\/+$/g, '')
    const normalizedChild = child.replace(/^\/+|\/+$/g, '')

    if (normalizedParent === normalizedChild)
      return false

    // Check if child starts with parent path followed by a slash
    return normalizedChild.startsWith(`${normalizedParent}/`)
  }

  /**
   * Determines if a path should be included based on inclusion settings
   * @param path The path to check
   * @returns true if the path should be included
   */
  private isPathIncluded(path: string): boolean {
    // If no inclusions are specified, nothing is included by default
    if (this.includedFolders.size === 0) {
      console.warn(`❌ No inclusions specified, excluding: ${path}`)
      return false
    }

    // Normalize the path
    const normalizedPath = path.replace(/^\/+|\/+$/g, '')

    // Check if the path or any of its parents are explicitly included
    for (const includedPath of this.includedFolders) {
      const normalizedIncludedPath = includedPath.replace(/^\/+|\/+$/g, '')
      if (normalizedPath === normalizedIncludedPath || this.isParentPath(normalizedIncludedPath, normalizedPath)) {
        console.warn(`✅ Path included: ${normalizedPath} (matches included path: ${normalizedIncludedPath})`)
        return true
      }
    }

    console.warn(`❌ Path not in included paths: ${normalizedPath}`)
    return false
  }

  /**
   * Determines if a file should be excluded from processing
   * The logic follows these steps:
   * 1. Root files are never included by default
   * 2. Check if the file's path is included (if inclusions are specified)
   * 3. For files, check file-specific exclusions
   * @param file The file to check
   * @returns true if the file should be excluded
   */
  isExcluded(file: TAbstractFile): boolean {
    // Handle root files (no parent)
    if (!file.parent) {
      console.warn(`❌ Root file excluded: ${file.path}`)
      return true // Root files are not included by default
    }

    console.warn(`\n📂 Checking file: ${file.path}`)
    console.warn(`Current inclusions: ${Array.from(this.includedFolders).join(', ')}`)

    // First check if the path is included
    if (!this.isPathIncluded(file.parent.path)) {
      return true
    }

    // For files, also check file-specific exclusions
    if (file instanceof TFile) {
      const normalizedPath = file.path.replace(/^\/+|\/+$/g, '')
      for (const pattern of this.ignoredFiles) {
        const normalizedPattern = pattern.replace(/^\/+|\/+$/g, '')
        // Check if the file path contains the pattern
        if (normalizedPath.includes(normalizedPattern)) {
          console.warn(`🚫 File excluded by pattern: ${normalizedPath} (matches pattern: ${normalizedPattern})`)
          return true
        }
      }
    }

    console.warn(`✅ File will be processed: ${file.path}`)
    return false
  }

  /**
   * Updates the inclusion/exclusion patterns
   * @param inclusions The new inclusion settings
   */
  updatePatterns(inclusions: { includedFolders: string }) {
    // Initialize settings if they don't exist
    if (!this.plugin.settings) {
      this.plugin.settings = DEFAULT_SETTINGS
    }
    this.plugin.settings.inclusions = inclusions
    this.loadSettings()
  }
}
