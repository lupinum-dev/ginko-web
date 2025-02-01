import type { GinkoWebSettings } from '../settings/settingsTypes'
import { createContext } from 'unctx'
import { useGinkoProcessor } from './useGinkoProcessor'

// Create a context for GinkoSettings
const settingsContext = createContext<GinkoWebSettings>()

// Export the use function
export const useGinkoSettings = settingsContext.use

// Initialize function to be called once from main.ts
export function initializeGinkoSettings(
  settings: GinkoWebSettings,
): GinkoWebSettings {
  // Create new instance if none exists
  if (!settingsContext.tryUse()) {
    settingsContext.set(settings)
  }
  return settingsContext.use()
}

/**
 * Update Ginko settings and sync with processor
 */
export function updateGinkoSettings(settings: GinkoWebSettings): void {
  const currentSettings = settingsContext.tryUse()
  if (!currentSettings) {
    // If no context exists, initialize it
    settingsContext.set(settings)
  }
  else {
    // Update existing settings object properties
    Object.assign(currentSettings, settings)
  }

  // Update the processor's settings
  const ginkoProcessor = useGinkoProcessor()
  if (ginkoProcessor) {
    ginkoProcessor.updateSettings(settings)
  }
}

export type { GinkoWebSettings }
