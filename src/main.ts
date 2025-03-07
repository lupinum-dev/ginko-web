import { Plugin, ItemView, WorkspaceLeaf } from 'obsidian'
import { setupFileWatcher } from './services/fileWatcher'
import { createApp } from 'vue'


// Define view types
const FILE_GRAPH_VIEW_TYPE = 'ginko-file-graph-view';

export default class GinkoWebPlugin extends Plugin {
  async onload() {
    this.registerCommands()
    
    // Only setup file watcher if the service exists

      setupFileWatcher(this, this.app)

  
  }

  onunload() {
    // Deregister the views
    this.app.workspace.detachLeavesOfType(FILE_GRAPH_VIEW_TYPE);
  }

  async loadSettings() {
    // Placeholder for future settings implementation
  }

  async saveSettings() {
    // Placeholder for future settings implementation
  }

  private registerCommands() {
    this.registerBasicCommands()
  }

  private registerBasicCommands() {
    // Add a command to open the file graph view

  }

}
