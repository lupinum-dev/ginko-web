import { Plugin, ItemView, WorkspaceLeaf } from 'obsidian'
import { setupFileWatcher } from './services/fileWatcher'
import { createApp } from 'vue'
import FileGraphView from './components/FileGraphView.vue'

// Define view types
const FILE_GRAPH_VIEW_TYPE = 'ginko-file-graph-view';

export default class GinkoWebPlugin extends Plugin {
  async onload() {
    this.registerCommands()
    
    // Only setup file watcher if the service exists
    if (typeof setupFileWatcher === 'function') {
      setupFileWatcher(this, this.app)
    }
    
    // Register the graph view
    this.registerView(
      FILE_GRAPH_VIEW_TYPE,
      (leaf) => new GinkoFileGraphView(leaf, this.app)
    );
    
    // Add a ribbon icon to open the file graph view
    this.addRibbonIcon('network', 'Show Vault Files Graph', () => {
      this.activateView(FILE_GRAPH_VIEW_TYPE);
    });
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
    this.addCommand({
      id: 'open-file-graph-view',
      name: 'Open File Graph View',
      callback: () => {
        this.activateView(FILE_GRAPH_VIEW_TYPE);
      }
    });
  }
  
  // Helper method to activate a view
  async activateView(viewType: string) {
    try {
      const { workspace } = this.app;
      
      // Check if view is already open
      const existingLeaves = workspace.getLeavesOfType(viewType);
      if (existingLeaves.length > 0) {
        // If it exists, reveal it
        workspace.revealLeaf(existingLeaves[0]);
        return;
      }
      
      // Otherwise, create a new leaf in the right sidebar
      const leaf = workspace.getRightLeaf(false);
      if (leaf) {
        await leaf.setViewState({
          type: viewType,
          active: true,
        });
        
        workspace.revealLeaf(leaf);
      }
    } catch (error) {
      console.error(`Failed to activate view ${viewType}:`, error);
    }
  }
}

// Custom view class for the file graph
class GinkoFileGraphView extends ItemView {
  private vueApp: any;
  private obsidianApp: any;
  
  constructor(leaf: WorkspaceLeaf, app: any) {
    super(leaf);
    this.obsidianApp = app;
  }
  
  getViewType(): string {
    return FILE_GRAPH_VIEW_TYPE;
  }
  
  getDisplayText(): string {
    return 'Vault Files Graph';
  }
  
  async onOpen() {
    try {
      const container = this.containerEl.children[1];
      container.empty();

      
      // Create a div for the Vue app
      const vueContainer = container.createDiv({ cls: 'ginko-file-graph-container' });
      
      
      // Mount the Vue app with the safe app object
      this.vueApp = createApp(FileGraphView, { app: this.obsidianApp });
      this.vueApp.mount(vueContainer);
      
      console.log('FileGraphView component mounted successfully');
    } catch (error) {
      console.error('Error opening FileGraphView:', error);
    }
  }
  
  async onClose() {
    // Unmount the Vue app when the view is closed
    if (this.vueApp) {
      try {
        this.vueApp.unmount();
      } catch (error) {
        console.error('Error unmounting Vue app:', error);
      }
    }
  }
}