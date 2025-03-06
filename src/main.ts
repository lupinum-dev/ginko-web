import { Plugin, ItemView, WorkspaceLeaf } from 'obsidian'
import { setupFileWatcher } from './processor/services/fileWatcher'
import { createApp } from 'vue'
import FileListView from './components/FileListView.vue'

// Define a view type for our file list
const FILE_LIST_VIEW_TYPE = 'ginko-file-list-view';

export default class GinkoWebPlugin extends Plugin {
  async onload() {
    this.registerCommands()
    setupFileWatcher(this, this.app)
    
    // Register the custom view
    this.registerView(
      FILE_LIST_VIEW_TYPE,
      (leaf) => new GinkoFileListView(leaf, this.app)
    );
    
    // Add a ribbon icon to open the file list view
    this.addRibbonIcon('folder', 'Show Vault Files', () => {
      this.activateView();
    });
  }

  onunload() {
    // Deregister the view
    this.app.workspace.detachLeavesOfType(FILE_LIST_VIEW_TYPE);
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
    // Add a command to open the file list view
    this.addCommand({
      id: 'open-file-list-view',
      name: 'Open File List View',
      callback: () => {
        this.activateView();
      }
    });
  }
  
  // Helper method to activate the file list view
  async activateView() {
    const { workspace } = this.app;
    
    // Check if view is already open
    const existingLeaves = workspace.getLeavesOfType(FILE_LIST_VIEW_TYPE);
    if (existingLeaves.length > 0) {
      // If it exists, reveal it
      workspace.revealLeaf(existingLeaves[0]);
      return;
    }
    
    // Otherwise, create a new leaf in the right sidebar
    const leaf = workspace.getRightLeaf(false);
    await leaf.setViewState({
      type: FILE_LIST_VIEW_TYPE,
      active: true,
    });
    
    workspace.revealLeaf(leaf);
  }
}

// Custom view class for the file list
class GinkoFileListView extends ItemView {
  private vueApp: any;
  private obsidianApp: any;
  
  constructor(leaf: WorkspaceLeaf, app: any) {
    super(leaf);
    this.obsidianApp = app;
  }
  
  getViewType(): string {
    return FILE_LIST_VIEW_TYPE;
  }
  
  getDisplayText(): string {
    return 'Vault Files';
  }
  
  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    
    // Create a div for the Vue app
    const vueContainer = container.createDiv({ cls: 'ginko-file-list-container' });
    
    // Mount the Vue app
    this.vueApp = createApp(FileListView, { app: this.obsidianApp });
    this.vueApp.mount(vueContainer);
  }
  
  async onClose() {
    // Unmount the Vue app when the view is closed
    if (this.vueApp) {
      this.vueApp.unmount();
    }
  }
}
