import type { Menu, TAbstractFile } from 'obsidian'
import type { GinkoWebSettings } from './settings/settingsTypes'
import { Notice, Plugin, setIcon, TFile, TFolder, App, Modal, ToggleComponent } from 'obsidian'
import { initializeFileTypeDetector } from './composables/useFileType'
import { initializeGinkoProcessor, useGinkoProcessor } from './composables/useGinkoProcessor'
import { initializeGinkoSettings, updateGinkoSettings } from './composables/useGinkoSettings'
import { CacheService } from './processor/services/CacheService'

import { DEFAULT_SETTINGS, ensureSettingsInitialized, isSetupComplete } from './settings/settingsTypes'
import { getWebsitePath } from './settings/settingsUtils'
import { createColocationFolder } from './tools/createColocationFolder'
import { ColocationModal } from './ui/modals/ColocationModal'
import { CURRENT_WELCOME_VERSION, WELCOME_VIEW_TYPE, WelcomeView } from './welcome/welcomeView'
import { db } from './db' // Import the database
import { DatabaseReplicationService } from './services/DatabaseReplicationService'
import { PerformanceTestService } from './services/PerformanceTestService'
import { setupFileWatcher, FileWatcher } from './sync/FileWatcher';
import { fileDB } from './sync/FileDatabase';


/**
 * Exports database contents to a JSON file
 */
async function exportDatabaseToJson(app: App): Promise<void> {
  try {
    // Collect data from GinkoDB
    const ginkoData = {
      notes: await db.getNotesTable().toArray(),
      assets: await db.getAssetsTable().toArray(),
      settings: await db.getSettingsTable().toArray()
    };

    // Collect data from MetaFileDB
    const metaFileData = {
      files: await fileDB.files.toArray(),
      syncState: await fileDB.syncState.toArray()
    };

    // Combine all data
    const databaseExport = {
      timestamp: new Date().toISOString(),
      metaFileDB: metaFileData
    };

    // Create JSON content
    const jsonContent = JSON.stringify(databaseExport, null, 2);

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
    const filename = `ginko-database-export-${timestamp}.json`;

    // Save to file in vault
    const adapter = app.vault.adapter;
    const exportFolder = '.ginko-exports';

    // Ensure export folder exists
    if (!(await adapter.exists(exportFolder))) {
      await adapter.mkdir(exportFolder);
    }

    const filePath = `${exportFolder}/${filename}`;
    await adapter.write(filePath, jsonContent);

    new Notice(`✅ Database exported to ${filePath}`);
    return filePath;
  } catch (error) {
    console.error('Failed to export database:', error);
    new Notice(`❌ Failed to export database: ${error.message}`);
    throw error;
  }
}

// Simple confirmation modal implementation
class ConfirmationModal extends Modal {
  private onConfirm: () => void;
  private title: string;
  private message: string;
  private confirmText: string;
  private cancelText: string;

  constructor(
    app: App,
    {
      title,
      message,
      onConfirm,
      confirmText = 'Confirm',
      cancelText = 'Cancel'
    }: {
      title: string;
      message: string;
      onConfirm: () => void;
      confirmText?: string;
      cancelText?: string;
    }
  ) {
    super(app);
    this.title = title;
    this.message = message;
    this.onConfirm = onConfirm;
    this.confirmText = confirmText;
    this.cancelText = cancelText;
  }

  onOpen() {
    const { contentEl } = this;

    contentEl.createEl('h2', { text: this.title });
    contentEl.createEl('p', { text: this.message });

    const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });

    const confirmButton = buttonContainer.createEl('button', { text: this.confirmText, cls: 'mod-cta' });
    confirmButton.addEventListener('click', () => {
      this.close();
      this.onConfirm();
    });

    const cancelButton = buttonContainer.createEl('button', { text: this.cancelText });
    cancelButton.addEventListener('click', () => {
      this.close();
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

// Define a type for Ribbon Icon configuration
interface RibbonIcon {
  id: string;
  name: string;
  handler?: () => Promise<void>;
}

export default class GinkoWebPlugin extends Plugin {
  settings: GinkoWebSettings;
  private statusBarItem: HTMLElement | null = null;
  private fileMenuRegistered: boolean = false;
  private ribbonIcons: HTMLElement[] = [];
  private performanceTestService: PerformanceTestService;
  private fileWatcher: FileWatcher | null = null;
  async onload() {
    // Load settings
    await this.loadSettings();


    // Initialize database
    try {
      await db.init();
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Failed to initialize database:', error);
      new Notice('Failed to initialize database. Some features may not work properly.');
    }

    // Setup core components and UI
    this.initializeCore();
    await this.setupUI();

    try {
      await fileDB.init();
    } catch (error) {
      console.error('Failed to initialize database:', error);
    }

    this.fileWatcher = setupFileWatcher(this, this.app);

    // Register plugin functionality
    this.registerCommands();
    this.registerFileMenu();

  }

  onunload() {
    this.app.workspace.detachLeavesOfType(WELCOME_VIEW_TYPE);
    this.fileMenuRegistered = false;

    // Close database connection when plugin is unloaded
    console.log('Closing database connection');
    db.close();
  }

  private initializeCore() {
    initializeGinkoSettings(this.settings);
    initializeFileTypeDetector('nuxt');
    initializeGinkoProcessor(this.app, this.settings, 'nuxt');
  }

  private async setupUI() {
    // Register welcome view
    this.registerView(
      WELCOME_VIEW_TYPE,
      leaf => new WelcomeView(leaf),
    );
    await this.activateWelcomeView();

    // Setup status bar
    this.statusBarItem = this.addStatusBarItem();
    this.statusBarItem.addClass('ginko-web-status-bar');
    await this.updateStatusBar();
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    this.settings = ensureSettingsInitialized(this.settings);
    await this.saveData(this.settings);

    // Update all dependent systems
    updateGinkoSettings(this.settings);
    this.registerFileMenu();
    this.registerCommands();
    await this.updateStatusBar();
  }

  async activateWelcomeView(forceShow = false) {
    const storageKey = `ginko-web-welcome-shown-v${CURRENT_WELCOME_VERSION}`;

    // Skip if user has seen this version (unless forced)
    if (!forceShow && localStorage.getItem(storageKey)) {
      return;
    }

    const { workspace } = this.app;

    // Check if view is already open
    const existingLeaves = workspace.getLeavesOfType(WELCOME_VIEW_TYPE);
    if (existingLeaves.length > 0) {
      workspace.revealLeaf(existingLeaves[0]);
      return;
    }

    // Create new leaf
    const leaf = workspace.getLeaf(true);
    if (leaf) {
      await leaf.setViewState({
        type: WELCOME_VIEW_TYPE,
        active: true,
      });
      workspace.revealLeaf(leaf);
    }
  }

  private async runProcessor(): Promise<void> {
    try {
      const ginkoProcessor = useGinkoProcessor();
      await ginkoProcessor.rebuild();
      new Notice('🟢 Processing completed');
    } catch (error) {
      console.error(`Error during processing: ${error.message}`);
      new Notice(`❌ Processing failed: ${error.message}`);
      throw error;
    }
  }

  private async exportCache(): Promise<void> {
    try {
      const cacheService = new CacheService();
      await cacheService.exportCacheToFile(this.app.vault);
      new Notice('✅ Cache exported successfully!');
    } catch (error) {
      console.error('Failed to export cache:', error);
      new Notice('❌ Failed to export cache');
    }
  }

  private async syncDatabase(): Promise<void> {
    try {
      const dbReplicationService = new DatabaseReplicationService(this.app);
      await dbReplicationService.syncAllFiles();
    } catch (error) {
      console.error('Failed to sync database:', error);
      new Notice('❌ Failed to sync database');
    }
  }




  private async createId(): Promise<void> {
    try {
      const { copyIdToClipboard } = await import('./tools/createId');
      copyIdToClipboard();
    } catch (error) {
      console.error('Failed to create ID:', error);
      new Notice('❌ Failed to create ID');
    }
  }

  private registerCommands() {
    // Clear existing ribbon icons
    this.ribbonIcons.forEach(icon => icon.remove());
    this.ribbonIcons = [];

    this.registerBasicCommands();
    this.registerUtilityCommands();
    this.setupRibbonIcons();
  }

  private registerBasicCommands() {
    this.addCommand({
      id: 'ginko-process',
      name: 'Process website content',
      callback: () => this.runProcessor(),
    });

    this.addCommand({
      id: 'ginko-open-welcome',
      name: 'Open Ginko welcome view',
      callback: () => this.activateWelcomeView(true),
    });

    this.addCommand({
      id: 'ginko-open-settings',
      name: 'Open Ginko settings',
      callback: () => {
        // @ts-ignore
        this.app.setting.open();
        // @ts-ignore
        this.app.setting.openTabById('ginko-web');
      },
    });

    this.addCommand({
      id: 'ginko-export-cache',
      name: 'Export Ginko cache',
      callback: () => this.exportCache(),
    });


  }

  private registerUtilityCommands() {
    if (this.settings.utilities.createId) {
      this.addCommand({
        id: 'ginko-create-id',
        name: 'Create and copy ID to clipboard',
        callback: () => this.createId(),
      });
    }

    // Add database viewer command
    this.addCommand({
      id: 'ginko-export-database',
      name: 'Export database contents to JSON file',
      callback: () => {
        exportDatabaseToJson(this.app);
      },
    });

    if (this.settings.utilities.colocationFolder) {
      this.addCommand({
        id: 'ginko-create-colocation-folder',
        name: 'Create colocation folder',
        editorCheckCallback: (checking: boolean, editor, view) => {
          const file = view.file;

          if (!file || file.extension !== 'md') {
            return false;
          }

          if (!checking) {
            new ColocationModal(
              this.app,
              this.settings,
              this.settings.utilities.lastUsedTemplate,
              async (result) => {
                try {
                  // Save template selection
                  this.settings.utilities.lastUsedTemplate = result.useTemplate;
                  await this.saveSettings();

                  // Create folder
                  await createColocationFolder(
                    this.app.vault,
                    file.parent?.path || '',
                    result
                  );

                  new Notice(`Created colocation folder for: ${file.name}`);
                } catch (error) {
                  console.error('Failed to create colocation folder:', error);
                  new Notice('❌ Failed to create colocation folder');
                }
              },
              file.path
            ).open();
          }

          return true;
        },
      });
    }

    // Add command to run processor
    this.addCommand({
      id: 'run-processor',
      name: 'Run processor',
      callback: async () => {
        await this.runProcessor();
      },
    });

    // Add command to export cache
    this.addCommand({
      id: 'export-cache',
      name: 'Export cache',
      callback: async () => {
        await this.exportCache();
      },
    });



    // Add command to create ID
    this.addCommand({
      id: 'create-id',
      name: 'Create ID',
      callback: async () => {
        await this.createId();
      },
    });

    this.addCommand({
      id: 'test-playground',
      name: 'Test Playground',
      callback: async () => {
        await this.testPlayground();
      }
    });

    // Add command to force resync
    this.addCommand({
      id: 'force-file-resync',
      name: 'Force Resync of All Files',
      callback: async () => {
        if (this.fileWatcher) {
          await this.fileWatcher.forceResync();
        }
      }
    });

    // Add command to force reset (clear database and resync) all file types
    this.addCommand({
      id: 'force-reset-sync',
      name: 'Reset Sync Database and Resync All Files',
      callback: async () => {
        if (this.fileWatcher) {
          await this.fileWatcher.forceReset();
        }
      }
    });

    // Add commands for specific file type resets
    this.addCommand({
      id: 'reset-meta-files',
      name: 'Reset and Resync Meta Files Only',
      callback: async () => {
        if (this.fileWatcher) {
          await this.fileWatcher.resetFileTypes(['meta']);
        }
      }
    });

    this.addCommand({
      id: 'reset-markdown-files',
      name: 'Reset and Resync Markdown Files Only',
      callback: async () => {
        if (this.fileWatcher) {
          await this.fileWatcher.resetFileTypes(['markdown']);
        }
      }
    });

    this.addCommand({
      id: 'reset-asset-files',
      name: 'Reset and Resync Asset Files Only',
      callback: async () => {
        if (this.fileWatcher) {
          await this.fileWatcher.resetFileTypes(['asset']);
        }
      }
    });

    // Add command to view sync performance
    this.addCommand({
      id: 'view-sync-performance',
      name: 'View Sync Performance Metrics',
      callback: () => {
        if (this.fileWatcher) {
          const report = this.fileWatcher.getPerformanceReport();
          console.log('Sync Performance Report:', report);
        }
      }
    });


  }

  private setupRibbonIcons() {
    const ribbonIcons: RibbonIcon[] = [
      { id: 'upload', name: 'Ginko Process' },

      // Add Create ID icon only when enabled
      ...(this.settings.utilities.createId ? [
        { id: 'key', name: 'Create ID', handler: () => this.createId() }
      ] : []),

      { id: 'database', name: 'Export GinkoCache', handler: () => this.exportCache() },
    ];

    for (const icon of ribbonIcons) {
      const element = this.addRibbonIcon(icon.id, icon.name, () => {
        if (icon.handler) {
          icon.handler();
        } else {
          this.runProcessor();
        }
      });

      element.addClass('my-plugin-ribbon-class');
      this.ribbonIcons.push(element);
    }
  }

  private async updateStatusBar() {
    if (!this.statusBarItem) return;

    this.statusBarItem.empty();

    const settings = ensureSettingsInitialized(this.settings);
    const websitePathInfo = await getWebsitePath(
      this.app.vault.adapter,
      settings.paths.type,
      settings.paths.websitePath,
    );

    const hasPackageManager = !!websitePathInfo.runtime;

    if (!isSetupComplete(settings, hasPackageManager)) {
      this.showSetupWarning();
    }
  }

  private showSetupWarning() {
    if (!this.statusBarItem) return;

    const warningContainer = this.statusBarItem.createSpan({
      cls: 'ginko-web-status-warning',
    });

    setIcon(warningContainer, 'alert-triangle');
    warningContainer.createSpan({ text: ' Complete Ginko Web setup!' });
    this.statusBarItem.style.cursor = 'pointer';

    this.statusBarItem.onclick = () => {
      // @ts-ignore
      this.app.setting.open();
      // @ts-ignore
      this.app.setting.openTabById('ginko-web');
    };
  }

  private registerFileMenu() {
    if (!this.settings.utilities.colocationFolder || this.fileMenuRegistered) {
      return;
    }

    this.fileMenuRegistered = true;

    this.registerEvent(
      this.app.workspace.on('file-menu', (menu: Menu, file: TAbstractFile) => {
        if (file instanceof TFolder) {
          this.addFolderMenuItem(menu, file);
        } else if (file instanceof TFile && file.extension === 'md') {
          this.addFileMenuItem(menu, file);
        }
      }),
    );
  }

  private addFolderMenuItem(menu: Menu, folder: TFolder) {
    menu.addItem((item) => {
      item
        .setTitle('Add Colocation Folder')
        .setIcon('folder-plus')
        .onClick(() => {
          this.openColocationModal(folder.path);
        });
    });
  }

  private addFileMenuItem(menu: Menu, file: TFile) {
    menu.addItem((item) => {
      item
        .setTitle('Convert to Colocation Folder')
        .setIcon('folder-input')
        .onClick(() => {
          this.openColocationModal(file.parent?.path || '', file.path);
        });
    });
  }

  private async testPlayground() {
    new Notice('Testing playground...');
    // get all files in the vault
    const files = this.app.vault.getFiles();
    console.log(files[0]);

    // get file to check for assets
    const file = files[0] as TFile; // Using the first file as an example

    // get all embedded assets for this file using Obsidian's metadata cache
    const embeddedAssets = this.getEmbeddedAssetsForFile(file);

    console.log('Embedded assets:', embeddedAssets);
  }

  private getEmbeddedAssetsForFile(file: TFile) {
    const embeddedAssets = [];

    // Get the cache for this file
    const cache = this.app.metadataCache.getCache(file.path);

    if (cache && cache.embeds) {
      // For each embed, find the corresponding file
      for (const embed of cache.embeds) {
        const link = embed.link;
        // Find the actual file in the vault
        const assets = this.app.metadataCache.getFirstLinkpathDest(link, file.path);
        if (assets) {
          embeddedAssets.push(assets);
        }
      }
    }

    return embeddedAssets;
  }

  private openColocationModal(folderPath: string, filePath?: string) {
    const modal = new ColocationModal(
      this.app,
      this.settings,
      this.settings.utilities.lastUsedTemplate,
      async (result) => {
        try {
          // Save template selection
          this.settings.utilities.lastUsedTemplate = result.useTemplate;
          await this.saveSettings();

          // Create folder
          const newFolderPath = await createColocationFolder(
            this.app.vault,
            folderPath,
            result,
          );

          const actionText = filePath ? 'Converted to' : 'Created';
          new Notice(`${actionText} colocation folder: ${newFolderPath}`);
        } catch (error) {
          console.error(`Error with colocation folder:`, error);
          new Notice(`Error: ${error.message}`);
        }
      },
      filePath,
    );

    modal.open();
  }

  /**
   * Run a performance test
   */
  private async runPerformanceTest(): Promise<void> {
    try {
      new Notice('Starting database performance test...');

      // Show options modal
      const modal = new PerformanceTestModal(this.app, async (options) => {
        await this.performanceTestService.runDatabaseReplicationTest(options);
      });

      modal.open();
    } catch (error) {
      console.error('Failed to run performance test:', error);
      new Notice('Failed to run performance test');
    }
  }
}

/**
 * Modal for performance test options
 */
class PerformanceTestModal extends Modal {
  private callback: (options: any) => Promise<void>;
  private testRuns = 3;
  private clearDatabase = false;
  private compareWithPrevious = false;

  constructor(app: App, callback: (options: any) => Promise<void>) {
    super(app);
    this.callback = callback;
  }

  onOpen() {
    const { contentEl } = this;

    contentEl.createEl('h2', { text: 'Database Performance Test Options' });

    // Test runs
    const testRunsContainer = contentEl.createDiv({ cls: 'setting-item' });
    testRunsContainer.createDiv({ cls: 'setting-item-name', text: 'Test Runs' });
    const testRunsDesc = testRunsContainer.createDiv({ cls: 'setting-item-description' });
    testRunsDesc.setText('Number of test runs to perform for averaging results');
    const testRunsControl = testRunsContainer.createDiv({ cls: 'setting-item-control' });
    const testRunsInput = testRunsControl.createEl('input', {
      type: 'number',
      value: String(this.testRuns),
      attr: { min: '1', max: '10' }
    });
    testRunsInput.addEventListener('change', () => {
      this.testRuns = parseInt(testRunsInput.value);
    });

    // Clear database
    const clearDbContainer = contentEl.createDiv({ cls: 'setting-item' });
    clearDbContainer.createDiv({ cls: 'setting-item-name', text: 'Clear Database' });
    const clearDbDesc = clearDbContainer.createDiv({ cls: 'setting-item-description' });
    clearDbDesc.setText('Clear the database before running the test');
    const clearDbControl = clearDbContainer.createDiv({ cls: 'setting-item-control' });
    const clearDbToggle = new ToggleComponent(clearDbControl);
    clearDbToggle.setValue(this.clearDatabase);
    clearDbToggle.onChange(value => {
      this.clearDatabase = value;
    });

    // Compare with previous
    const compareContainer = contentEl.createDiv({ cls: 'setting-item' });
    compareContainer.createDiv({ cls: 'setting-item-name', text: 'Compare with Previous' });
    const compareDesc = compareContainer.createDiv({ cls: 'setting-item-description' });
    compareDesc.setText('Compare results with the previous test run');
    const compareControl = compareContainer.createDiv({ cls: 'setting-item-control' });
    const compareToggle = new ToggleComponent(compareControl);
    compareToggle.setValue(this.compareWithPrevious);
    compareToggle.onChange(value => {
      this.compareWithPrevious = value;
    });

    // Buttons
    const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });

    const runButton = buttonContainer.createEl('button', { text: 'Run Test' });
    runButton.addEventListener('click', async () => {
      this.close();
      await this.callback({
        testRuns: this.testRuns,
        clearDatabase: this.clearDatabase,
        compareWithPrevious: this.compareWithPrevious
      });
    });

    const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });
    cancelButton.addEventListener('click', () => {
      this.close();
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}