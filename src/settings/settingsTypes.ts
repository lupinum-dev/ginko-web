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
    [key: string]: boolean
  }
  paths: {
    type: 'none' | 'standard' | 'custom'
    websitePath?: string
    vaultPath?: string
    template?: string
    packageManager?: string
    pathConfigured: boolean
  }
  languages: {
    multipleLanguages: boolean
    mainLanguage: string
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
  console.log('🔍 validatePathConfiguration called:', {
    type: settings.websitePath.type,
    customPath: settings.websitePath.customPath,
    pathType: settings.websitePath.pathType,
    hasPackageManager,
  })

  const status = {
    isValid: false,
    hasPackageManager,
    message: 'Please configure your website path',
  }

  // First check if we have a valid type selected
  if (settings.websitePath.type === 'none') {
    settings.pathConfiguration.isConfigured = false
    status.message = 'Please select a website location'
    console.log('❌ Path validation - none type:', status)
    return status
  }

  // For standard path, check if package manager is detected
  if (settings.websitePath.type === 'standard') {
    status.isValid = hasPackageManager
    status.message = hasPackageManager
      ? '✓ Configuration valid - Ready to use Ginko'
      : '⚠ Website folder found but no package manager detected'

    // Update the isConfigured flag
    settings.pathConfiguration.isConfigured = status.isValid
    console.log('🔍 Path validation - standard path:', status)
    return status
  }

  // For custom path, check if both path and type are set and package manager is detected
  if (settings.websitePath.type === 'custom') {
    // Check if we have all required fields
    if (!settings.websitePath.customPath || !settings.websitePath.pathType) {
      settings.pathConfiguration.isConfigured = false
      status.message = 'Please complete the custom path configuration'
      console.log('❌ Path validation - incomplete custom path:', status)
      return status
    }

    // Update status based on package manager
    status.isValid = hasPackageManager
    status.message = hasPackageManager
      ? '✓ Configuration valid - Ready to use Ginko'
      : '⚠ Website folder found but no package manager detected'

    // Update the isConfigured flag
    settings.pathConfiguration.isConfigured = status.isValid
    console.log('🔍 Path validation - custom path:', status)
    return status
  }

  // If we get here, something is wrong with the configuration
  settings.pathConfiguration.isConfigured = false
  console.log('❌ Path validation - invalid configuration:', status)
  return status
}

export function isPathConfigurationValid(settings: GinkoWebSettings, hasPackageManager = false): boolean {
  return validatePathConfiguration(settings, hasPackageManager).isValid
}

export function isSetupComplete(settings: GinkoWebSettings, hasPackageManager = false): boolean {
  // Check if required steps 1-3 are completed
  return (
    // Step 1: Usage is configured
    settings.usage.isConfigured
    // Step 2: Framework is selected
    && !!settings.websitePath.template
    // Step 3: Path is configured, valid, and has package manager
    && isPathConfigurationValid(settings, hasPackageManager)
  )
  // Steps 4 and 5 are optional and not required for setup completion
}

export const DEFAULT_SETTINGS: GinkoWebSettings = {
  usage: {
    type: null,
    isConfigured: false,
  },
  utilities: {
    debug: false,
    colocationFolder: false,
    linter: false,
  },
  websitePath: {
    type: 'none',
    template: '',
  },
  languages: {
    multipleLanguages: false,
    mainLanguage: 'en',
  },
  exclusions: {
    ignoredFolders: '',
    ignoredFiles: '',
  },
  pathConfiguration: {
    isConfigured: false,
  },
}
