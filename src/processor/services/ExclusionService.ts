import type { GinkoWebSettings } from '../../settings/settingsTypes'
import { minimatch } from 'minimatch'

export class ExclusionService {
  private ignoredFolderPatterns: string[] = []
  private ignoredFilePatterns: string[] = []

  constructor(settings: GinkoWebSettings) {
    this.updatePatterns(settings)
  }

  public updatePatterns(settings: GinkoWebSettings): void {
    // Parse folder patterns
    this.ignoredFolderPatterns = settings.exclusions.ignoredFolders
      .split(',')
      .map(p => p.trim())
      .filter(p => p.length > 0)
      .map(p => this.normalizePattern(p))

    // Parse file patterns
    this.ignoredFilePatterns = settings.exclusions.ignoredFiles
      .split(',')
      .map(p => p.trim())
      .filter(p => p.length > 0)
      .map(p => this.normalizePattern(p))
  }

  private normalizePattern(pattern: string): string {
    // Convert pattern to use forward slashes for consistency
    pattern = pattern.replace(/\\/g, '/')

    // If pattern doesn't contain a slash and doesn't start with **, make it match anywhere in the path
    if (!pattern.includes('/') && !pattern.startsWith('**')) {
      pattern = `**/${pattern}`
    }

    // Only add /** suffix for directory patterns that don't have an extension or wildcard
    if (!pattern.includes('.') && !pattern.includes('*') && !pattern.endsWith('**')) {
      pattern = `${pattern}/**`
    }

    // Ensure the pattern is properly formatted for minimatch
    if (pattern.includes('*')) {
      // Remove any duplicate ** patterns
      pattern = pattern.replace(/\*{2,}/g, '**')
    }

    return pattern
  }

  public isExcluded(filePath: string): boolean {
    // Normalize path to use forward slashes
    filePath = filePath.replace(/\\/g, '/')

    // Common minimatch options for consistent behavior
    const matchOptions = {
      dot: true, // Match dotfiles
      nobrace: true, // Disable brace expansion
      nocase: true, // Case insensitive matching
      matchBase: true, // Allow matching basename of filepath
    }

    // Check file patterns first
    for (const pattern of this.ignoredFilePatterns) {
      if (minimatch(filePath, pattern, matchOptions)) {
        return true
      }
    }

    // Then check folder patterns
    for (const pattern of this.ignoredFolderPatterns) {
      if (minimatch(filePath, pattern, matchOptions)) {
        return true
      }
    }

    // Also check each directory segment against folder patterns
    const segments = filePath.split('/')
    for (let i = 0; i < segments.length; i++) {
      const partialPath = segments.slice(0, i + 1).join('/')
      for (const pattern of this.ignoredFolderPatterns) {
        if (minimatch(partialPath, pattern, matchOptions)) {
          return true
        }
      }
    }

    return false
  }
}
