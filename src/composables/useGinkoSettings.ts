import type { GinkoWebSettings } from '../settings/settingsTypes'
import { createContext } from 'unctx'

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

export type { GinkoWebSettings }
