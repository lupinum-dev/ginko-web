import type { Plugin } from 'obsidian'
import type { GinkoSettings } from '../utils/types'

export interface GinkoPlugin extends Plugin {
  settings: GinkoSettings
  devServer: any
  getServerPort: () => number
  startDevServer: () => Promise<void>
  stopDevServer: () => Promise<void>
  getServerLogs: () => string[]
  subscribeToServerLogs: (callback: (message: string) => void) => () => void
  rebuild: () => Promise<void>
  rebuildMarkdown: () => Promise<void>
  rebuildGalleries: () => Promise<void>
  rebuildAssets: () => Promise<void>
  clearCache: () => Promise<void>
}
