import type { App, TAbstractFile } from 'obsidian'
import type GinkoWebPlugin from '../../main'
import { TFile } from 'obsidian'
import { useFileType } from '../../composables/useFileType'
import { useGinkoProcessor } from '../../composables/useGinkoProcessor'

export function setupFileWatcher(plugin: GinkoWebPlugin, app: App) {
  const ginkoProcessor = useGinkoProcessor()

  app.workspace.onLayoutReady(() => {
    plugin.registerEvent(
      app.vault.on('modify', (file: TAbstractFile) => {
        if (file instanceof TFile) {
          ginkoProcessor.addTask(file.path, 'modify')
        }
      }),
    )

    plugin.registerEvent(
      app.vault.on('rename', (file: TAbstractFile, oldPath: string) => {
        if (file instanceof TFile) {
          const { isSameFileType } = useFileType()

          if (isSameFileType(file.path, oldPath)) {
            // If file types are the same, process as a regular rename
            ginkoProcessor.addTask(file.path, 'rename', oldPath)
          }
          else {
            // If file types are different, process as a delete + create
            ginkoProcessor.addTask(oldPath, 'delete')
            ginkoProcessor.addTask(file.path, 'create')
          }
        }
      }),
    )

    plugin.registerEvent(
      app.vault.on('create', (file: TAbstractFile) => {
        if (file instanceof TFile) {
          ginkoProcessor.addTask(file.path, 'create')
        }
      }),
    )

    plugin.registerEvent(
      app.vault.on('delete', (file: TAbstractFile) => {
        if (file instanceof TFile) {
          ginkoProcessor.addTask(file.path, 'delete')
        }
      }),
    )
  })
}
