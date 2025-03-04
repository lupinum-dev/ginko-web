# Ginko Web Settings Management

## Overview

The settings management system in Ginko Web provides a comprehensive framework for controlling all aspects of the plugin's behavior, from path configuration to utility toggles and language settings.

## File Structure

- **settingsTypes.ts**: Defines core interfaces and validation functions
- **settingsConstants.ts**: Contains static configuration values
- **settings.ts**: Implements settings management logic
- **settingsUtils.ts**: Provides utility functions for settings operations
- **useGinkoSettings.ts**: Vue composable for global settings access

## Key Interfaces

```typescript
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
    type: 'none' | 'standard' | 'custom'
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
```

## Settings Storage

Settings are managed using a context-based approach with the `unctx` library:

```typescript
// Create a context for GinkoSettings
const settingsContext = createContext<GinkoWebSettings>()

// Export the use function
export const useGinkoSettings = settingsContext.use

// Initialize function
export function initializeGinkoSettings(
  settings: GinkoWebSettings,
): GinkoWebSettings {
  if (!settingsContext.tryUse()) {
    settingsContext.set(settings)
  }
  return settingsContext.use()
}
```

This pattern ensures settings are accessible throughout the application while maintaining a single source of truth.

## Validation Logic

The settings system includes validation for critical configuration:

```typescript
export function validatePathConfiguration(
  settings: GinkoWebSettings, 
  hasPackageManager: boolean
): PathValidationStatus {
  // Validation checks path type and existence
  // Returns status with isValid flag and message
}

export function isSetupComplete(
  settings: GinkoWebSettings, 
  hasPackageManager = false
): boolean {
  // Ensures all required configuration is complete
  // Checks usage, framework, language, and paths
}
```

## Default Values

Default settings ensure the application starts in a predictable state:

```typescript
export function ensureSettingsInitialized(
  settings: Partial<GinkoWebSettings>
): GinkoWebSettings {
  return {
    usage: {
      type: settings.usage?.type ?? null,
      isConfigured: settings.usage?.isConfigured ?? false,
      licenseKey: settings.usage?.licenseKey,
    },
    utilities: {
      debug: settings.utilities?.debug ?? false,
      colocationFolder: settings.utilities?.colocationFolder ?? false,
      // ... other defaults
    },
    // ... other section defaults
  }
}

export const DEFAULT_SETTINGS: GinkoWebSettings = 
  ensureSettingsInitialized({})
```

## Integration with Processor

Settings changes propagate to the processor component:

```typescript
export function updateGinkoSettings(
  settings: GinkoWebSettings
): void {
  const currentSettings = settingsContext.tryUse()
  if (!currentSettings) {
    settingsContext.set(settings)
  }
  else {
    Object.assign(currentSettings, settings)
  }

  // Update the processor's settings
  const ginkoProcessor = useGinkoProcessor()
  if (ginkoProcessor) {
    ginkoProcessor.updateSettings(settings)
  }
}
```

## Website Templates

The plugin supports multiple website frameworks defined in settingsConstants:

```typescript
export const WEBSITE_TEMPLATES: WebsiteTemplate[] = [
  {
    id: 'nuxt-ui-pro-docs',
    name: 'Nuxt UI Pro Docs',
    icon: '...',
    description: 'Beautiful documentation template with Nuxt UI Pro components',
  },
  // Other templates...
]
```

## Utility Features

Toggle-able utilities enhance plugin functionality:

```typescript
export const UTILITIES: Utility[] = [
  {
    id: 'colocationFolder',
    name: 'Colocation Folder',
    description: 'Utility which helps you to create a colocation folder.',
    warning: '',
    links: [
      { text: 'Read our documentation', url: '...' },
    ],
  },
  // Other utilities...
]
```

## Implementation Notes

- Settings changes trigger immediate UI updates
- Path validation provides real-time feedback
- Default values ensure graceful handling of missing configuration
- Type safety throughout the settings system prevents configuration errors