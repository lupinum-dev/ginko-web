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
      
      // Create a simple app object with only the necessary properties
      const safeApp = {
        vault: {
          getAllLoadedFiles: () => {
            // Create a safe copy of the files to avoid proxy issues
            const files = this.obsidianApp.vault.getAllLoadedFiles();
            return files.map((file: any) => {
              try {
                return {
                  name: file.name,
                  path: file.path,
                  extension: file.extension || '',
                  children: file.children || null,
                  stat: file.stat ? {
                    size: file.stat.size,
                    mtime: file.stat.mtime
                  } : null
                };
              } catch (error) {
                console.error('Error creating safe file copy:', error);
                return {
                  name: '',
                  path: '',
                  extension: '',
                  children: null,
                  stat: null
                };
              }
            });
          },
          getAbstractFileByPath: (path: string) => {
            // Safely proxy the getAbstractFileByPath method
            try {
              return this.obsidianApp.vault.getAbstractFileByPath(path);
            } catch (error) {
              console.error('Error getting file by path:', error);
              return null;
            }
          },
          cachedRead: async (file: any) => {
            // Safely proxy the cachedRead method from the obsidian app
            try {
              // If we received a simplified file object, we need to get the original file
              if (file && typeof file === 'object' && file.path) {
                // Find the original file by path
                const originalFile = this.obsidianApp.vault.getAbstractFileByPath(file.path);
                if (originalFile) {
                  return await this.obsidianApp.vault.cachedRead(originalFile);
                }
              }
              // Fallback to direct call if the file is already a proper Obsidian file object
              return await this.obsidianApp.vault.cachedRead(file);
            } catch (error) {
              console.error('Error reading file:', error);
              return '';
            }
          }
        }
      };
      
      // Mount the Vue app with the safe app object
      this.vueApp = createApp(FileGraphView, { app: safeApp });
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