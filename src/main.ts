import { Plugin } from 'obsidian'
import { setupFileWatcher } from './processor/services/fileWatcher'

export default class GinkoWebPlugin extends Plugin {
  async onload() {
    this.registerCommands()
    setupFileWatcher(this, this.app)
  }

  onunload() {

  }

  async loadSettings() {

  }

  async saveSettings() {

  }

  private registerCommands() {
    this.registerBasicCommands()
  }

  private registerBasicCommands() {
    // this.addCommand({
    //   id: 'ginko-process',
    //   name: 'Process website content',
    //   callback: () => this.runProcessor(),
    // });

  }
}
