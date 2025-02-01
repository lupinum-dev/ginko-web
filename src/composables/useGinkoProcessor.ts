import type { App } from 'obsidian'
import type { GinkoWebSettings } from '../settings/settingsTypes'
import type { Framework } from '../types/framework'
import { createContext } from 'unctx'
import { GinkoProcessor } from '../processor/services/GinkoProcessor'

// Create a context for GinkoProcessor
const ginkoContext = createContext<GinkoProcessor>()

// Export the use function
export const useGinkoProcessor = ginkoContext.use

// Initialize function to be called once from main.ts
export function initializeGinkoProcessor(
  app: App,
  settings: GinkoWebSettings,
  framework: Framework = 'nuxt',
): GinkoProcessor {
  // Create new instance if none exists
  if (!ginkoContext.tryUse()) {
    console.log('Initializing Ginko Processor with settings:', settings)
    const processor = new GinkoProcessor(app, settings, framework)
    ginkoContext.set(processor)
  }

  return ginkoContext.use()
}
