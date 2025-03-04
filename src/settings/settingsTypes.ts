/**
 * Represents a link in a utility description
 */
export interface UtilityLink {
  text: string
  url: string
}

/**
 * Represents a utility that can be enabled in settings
 */
export interface Utility {
  id: keyof GinkoWebSettings['utilities']
  name: string
  description: string
  warning: string
  links: UtilityLink[]
}

/**
 * Represents a website template that can be selected
 */
export interface WebsiteTemplate {
  id: string
  name: string
  icon: string
  description: string
}

/**
 * Main settings interface for the Ginko Web plugin
 */
export interface GinkoWebSettings {
  // Usage and licensing settings
  usage: {
    type: 'personal' | 'commercial' | null
    licenseKey?: string
    isConfigured: boolean
  }

  // Utility feature toggles
  utilities: {
    debug: boolean
    colocationFolder: boolean
    createId: boolean
    linter: boolean
    frontmatter: boolean
    lastUsedTemplate: boolean
    [key: string]: boolean
  }

  // Path configuration
  paths: {
    type: 'none' | 'standard' | 'custom'
    websitePath?: string
    vaultPath?: string
    template?: string
    packageManager?: string
    pathConfigured: boolean
    outputDirectoryPath?: string
    publicPath: string
  }

  // Language configuration
  languages: {
    type: 'none' | 'single' | 'multi'
    mainLanguage: string
    secondaryLanguages: string[]
  }

  // Content exclusion settings
  exclusions: {
    ignoredFolders: string
    ignoredFiles: string
  }
}

/**
 * Status of path configuration validation
 */
export interface PathValidationStatus {
  isValid: boolean
  hasPackageManager: boolean
  message: string
}

/**
 * Validates the path configuration in settings
 */
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
    return validateStandardPath(settings, hasPackageManager, status)
  }

  // For custom path, check if path is set and package manager is detected
  if (settings.paths.type === 'custom') {
    return validateCustomPath(settings, hasPackageManager, status)
  }

  // If we get here, something is wrong with the configuration
  settings.paths.pathConfigured = false
  return status
}

/**
 * Validates a standard path configuration
 */
function validateStandardPath(
  settings: GinkoWebSettings,
  hasPackageManager: boolean,
  status: PathValidationStatus
): PathValidationStatus {
  status.isValid = hasPackageManager
  status.message = hasPackageManager
    ? '✓ Configuration valid - Ready to use Ginko'
    : '⚠ Website folder found but no package manager detected'

  // Update the pathConfigured flag
  settings.paths.pathConfigured = status.isValid
  return status
}

/**
 * Validates a custom path configuration
 */
function validateCustomPath(
  settings: GinkoWebSettings,
  hasPackageManager: boolean,
  status: PathValidationStatus
): PathValidationStatus {
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

/**
 * Helper function to check if path configuration is valid
 */
export function isPathConfigurationValid(
  settings: GinkoWebSettings,
  hasPackageManager = false
): boolean {
  return validatePathConfiguration(settings, hasPackageManager).isValid
}

/**
 * Ensures all required settings fields are initialized with defaults
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
      createId: settings.utilities?.createId ?? false,
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

// Default settings with all values initialized
export const DEFAULT_SETTINGS: GinkoWebSettings = ensureSettingsInitialized({})

/**
 * Checks if the Ginko Web setup is complete based on settings
 */
export function isSetupComplete(settings: GinkoWebSettings, hasPackageManager = false): boolean {
  // Ensure we have valid settings object
  const validatedSettings = ensureSettingsInitialized(settings)

  // Check each required configuration step
  if (!isBasicConfigValid(validatedSettings)) {
    return false
  }

  // If we're in custom path mode, we need a valid website path
  if (validatedSettings.paths.type === 'custom' && !validatedSettings.paths.websitePath) {
    return false
  }

  // Package manager check is optional
  return true
}

/**
 * Helper to validate that basic configuration is complete
 */
function isBasicConfigValid(settings: GinkoWebSettings): boolean {
  return (
    // Step 1: Usage is configured
    settings.usage.isConfigured &&
    // Step 2: Framework is selected
    !!settings.paths.template &&
    // Step 3: Language is configured
    settings.languages.type !== 'none' &&
    (settings.languages.type === 'single' || !!settings.languages.mainLanguage) &&
    // Step 4: Path is configured
    settings.paths.pathConfigured
  )
}