import type { Menu, TAbstractFile } from 'obsidian'
import type { GinkoWebSettings } from './settings/settingsTypes'
import { Notice, Plugin, setIcon, TFile, TFolder } from 'obsidian'
import { initializeFileTypeDetector } from './composables/useFileType'
import { initializeGinkoProcessor, useGinkoProcessor } from './composables/useGinkoProcessor'
import { initializeGinkoSettings, updateGinkoSettings } from './composables/useGinkoSettings'
import { CacheService } from './processor/services/CacheService'
import { setupFileWatcher } from './processor/services/fileWatcher'
import { GinkoWebSettingTab } from './settings/settings'
import { DEFAULT_SETTINGS, ensureSettingsInitialized, isSetupComplete } from './settings/settingsTypes'
import { getWebsitePath } from './settings/settingsUtils'
import { createColocationFolder } from './tools/createColocationFolder'
import { ColocationModal } from './tools/ColocationModal'
import { CURRENT_WELCOME_VERSION, WELCOME_VIEW_TYPE, WelcomeView } from './welcome/welcomeView'

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

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new GinkoWebSettingTab(this.app, this));

    // Setup core components and UI
    this.initializeCore();
    await this.setupUI();

    // Register plugin functionality
    this.registerCommands();
    this.registerFileMenu();
    setupFileWatcher(this, this.app);
  }

  onunload() {
    this.app.workspace.detachLeavesOfType(WELCOME_VIEW_TYPE);
    this.fileMenuRegistered = false;
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
    const loadedSettings = await this.loadData();
    this.settings = ensureSettingsInitialized(loadedSettings || {});
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
}