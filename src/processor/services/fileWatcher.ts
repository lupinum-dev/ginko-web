import type { App, TAbstractFile } from 'obsidian'
import type GinkoWebPlugin from '../../main'
import { TFile } from 'obsidian'
import { useFileType } from '../../composables/useFileType'
import { useGinkoProcessor } from '../../composables/useGinkoProcessor'

export function setupFileWatcher(plugin: GinkoWebPlugin, app: App) {
    plugin.registerEvent(
      app.vault.on('modify', (file: TAbstractFile) => {
        if (file instanceof TFile) {
          console.log('modify', file.path)

        }
      }),
    )
    plugin.registerEvent(
      app.vault.on('rename', (file: TAbstractFile, oldPath: string) => {
        if (file instanceof TFile) {
          console.log('rename', file.path, oldPath)
        }
      }),
    )
    plugin.registerEvent(
      app.vault.on('create', (file: TAbstractFile) => {
        console.log('create', file.path)
      }),
    )
    plugin.registerEvent(
      app.vault.on('delete', (file: TAbstractFile) => {
        if (file instanceof TFile) {
          console.log('delete', file.path)
        }
      }),
    )
}
