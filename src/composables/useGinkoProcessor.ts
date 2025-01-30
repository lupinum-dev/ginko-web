import type { App } from 'obsidian'
import type { GinkoSettings } from '../../utils/types'
import type { Framework } from '../types/framework'
import { createContext } from 'unctx'
import { GinkoProcessor } from '../services/GinkoProcessor'

// Create a context for GinkoProcessor
const ginkoContext = createContext<GinkoProcessor>()

// Export the use function
export const useGinkoProcessor = ginkoContext.use

// Initialize function to be called once from main.ts
export function initializeGinkoProcessor(
  app: App,
  settings: GinkoSettings,
  framework: Framework = 'nuxt',
): GinkoProcessor {
  // Create new instance if none exists

  console.log('🌟🌟🌟', settings)
  if (!ginkoContext.tryUse()) {
    const processor = new GinkoProcessor(app, settings, framework)
    ginkoContext.set(processor)
  }

  return ginkoContext.use()
}
