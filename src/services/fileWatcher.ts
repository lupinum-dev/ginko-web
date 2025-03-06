import type { App, TAbstractFile } from 'obsidian'
import type GinkoWebPlugin from '../../main'

export function setupFileWatcher(plugin: GinkoWebPlugin, app: App) {
  app.workspace.onLayoutReady(() => {
    plugin.registerEvent(
      app.vault.on('modify', (file: TAbstractFile) => {
        console.log('modify', file)
      }),
    )

    plugin.registerEvent(
      app.vault.on('rename', (file: TAbstractFile, oldPath: string) => {
        console.log('rename', file, oldPath)
      }),
    )

    plugin.registerEvent(
      app.vault.on('create', (file: TAbstractFile) => {
        console.log('create', file)
      }),
    )

    plugin.registerEvent(
      app.vault.on('delete', (file: TAbstractFile) => {
        console.log('delete', file)
      }),
    )
  })
}
