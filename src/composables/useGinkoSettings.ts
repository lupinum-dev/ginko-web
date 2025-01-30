import { createContext } from 'unctx'
import { GinkoSettings } from '../../utils/types'

// Create a context for GinkoSettings
const settingsContext = createContext<GinkoSettings>()

// Export the use function
export const useGinkoSettings = settingsContext.use

// Initialize function to be called once from main.ts
export function initializeGinkoSettings(
  settings: GinkoSettings,
): GinkoSettings {
  // Create new instance if none exists
  if (!settingsContext.tryUse()) {
    settingsContext.set(settings)
  }
  
  return settingsContext.use()
} 

export type { GinkoSettings } 