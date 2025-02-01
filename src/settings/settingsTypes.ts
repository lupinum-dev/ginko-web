export interface UtilityLink {
  text: string
  url: string
}

export interface Utility {
  id: keyof GinkoWebSettings['utilities']
  name: string
  description: string
  warning: string
  links: UtilityLink[]
}

export interface WebsiteTemplate {
  id: string
  name: string
  icon: string
  description: string
}

export interface GinkoWebSettings {
  usage: {
    type: 'personal' | 'commercial' | null
    licenseKey?: string
    isConfigured: boolean
  }
  utilities: {
    debug: boolean
    colocationFolder: boolean
    linter: boolean
    frontmatter: boolean
    lastUsedTemplate: boolean
    [key: string]: boolean
  }
  paths: {
    type: 'none' | 'standard' | 'custom' | 'relative' | 'absolute'
    websitePath?: string
    vaultPath?: string
    template?: string
    packageManager?: string
    pathConfigured: boolean
    outputDirectoryPath?: string
    publicPath: string
  }
  languages: {
    type: 'none' | 'single' | 'multi'
    mainLanguage: string
    secondaryLanguages: string[]
  }
  exclusions: {
    ignoredFolders: string
    ignoredFiles: string
  }
}

export interface PathValidationStatus {
  isValid: boolean
  hasPackageManager: boolean
  message: string
}

export function validatePathConfiguration(settings: GinkoWebSettings, hasPackageManager: boolean): PathValidationStatus {
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

    // Update the pathConfigured flag
    settings.paths.pathConfigured = status.isValid
    return status
  }

  // For custom path, check if path is set and package manager is detected
  if (settings.paths.type === 'custom') {
    // Check if we have the required websitePath
    if (!settings.paths.websitePath) {
      settings.paths.pathConfigured = false
      status.message = 'Please complete the custom path configuration'
      return status
    }

    // Update status based on package manager
    status.isValid = hasPackageManager
    status.message = hasPackageManager
      ? '✓ Configuration valid - Ready to use Ginko'
      : '⚠ Website folder found but no package manager detected'

    // Update the pathConfigured flag
    settings.paths.pathConfigured = status.isValid
    return status
  }

  // If we get here, something is wrong with the configuration
  settings.paths.pathConfigured = false
  return status
}

export function isPathConfigurationValid(settings: GinkoWebSettings, hasPackageManager = false): boolean {
  return validatePathConfiguration(settings, hasPackageManager).isValid
}

/**
 * Ensures all required settings fields are initialized
 */
export function ensureSettingsInitialized(settings: Partial<GinkoWebSettings>): GinkoWebSettings {
  return {
    usage: {
      type: settings.usage?.type ?? null,
      isConfigured: settings.usage?.isConfigured ?? false,
      licenseKey: settings.usage?.licenseKey,
    },
    utilities: {
      debug: settings.utilities?.debug ?? false,
      colocationFolder: settings.utilities?.colocationFolder ?? false,
      linter: settings.utilities?.linter ?? false,
      frontmatter: settings.utilities?.frontmatter ?? false,
      lastUsedTemplate: settings.utilities?.lastUsedTemplate ?? false,
    },
    paths: {
      type: settings.paths?.type ?? 'none',
      websitePath: settings.paths?.websitePath ?? '',
      vaultPath: settings.paths?.vaultPath ?? '',
      template: settings.paths?.template ?? '',
      packageManager: settings.paths?.packageManager ?? '',
      pathConfigured: settings.paths?.pathConfigured ?? false,
      outputDirectoryPath: settings.paths?.outputDirectoryPath ?? '',
      publicPath: settings.paths?.publicPath ?? '',
    },
    languages: {
      type: settings.languages?.type ?? 'none',
      mainLanguage: settings.languages?.mainLanguage ?? '',
      secondaryLanguages: settings.languages?.secondaryLanguages ?? [],
    },
    exclusions: {
      ignoredFolders: settings.exclusions?.ignoredFolders ?? '',
      ignoredFiles: settings.exclusions?.ignoredFiles ?? '',
    },
  }
}

export const DEFAULT_SETTINGS: GinkoWebSettings = ensureSettingsInitialized({})

export function isSetupComplete(settings: GinkoWebSettings, hasPackageManager = false): boolean {
  // Ensure we have valid settings object
  const validatedSettings = ensureSettingsInitialized(settings)

  // Basic configuration checks
  const basicConfigValid = (
    // Step 1: Usage is configured
    validatedSettings.usage.isConfigured
    // Step 2: Framework is selected
    && !!validatedSettings.paths.template
    // Step 3: Language is configured
    && validatedSettings.languages.type !== 'none'
    && (validatedSettings.languages.type === 'single' || !!validatedSettings.languages.mainLanguage)
    // Step 4: Path is configured
    && validatedSettings.paths.pathConfigured
  )

  // If basic config is not valid, return false
  if (!basicConfigValid) {
    return false
  }

  // If we're in custom path mode, we need a valid website path
  if (validatedSettings.paths.type === 'custom' && !validatedSettings.paths.websitePath) {
    return false
  }

  // Package manager check is optional
  return true
}
