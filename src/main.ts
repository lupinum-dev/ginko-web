// src/main.ts
import { App, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { setupObsidianSync } from './adapters/obsidian-adapter';
import { resetVault } from './core/reset-vault';
import { DEFAULT_SETTINGS, Logger, SyncSettings } from './types';
import { createLogger } from './utils/logger';
import { normalizeSettingsPath, normalizeTargetPath } from './utils/path-utils';

export default class VaultSyncPlugin extends Plugin {
  settings: SyncSettings;
  private syncEngine: ReturnType<typeof setupObsidianSync> | null = null;
  private logger: Logger | null = null;
  
  async onload() {
    // Load settings
    await this.loadSettings();

    // Set Obsidian Root
    // TODO: Check on Windows if this path is normalized correctly
    this.settings = {
      ...this.settings,
      obsidianRoot: this.app.vault.getRoot().vault.adapter.basePath
    };

    // Initialize logger
    this.logger = createLogger(this.settings);
    this.logger.info('main', 'Initializing Vault Sync Plugin');
    
    // Initialize sync engine
    this.syncEngine = setupObsidianSync(this, this.app, this.settings, this.logger);
    
    // Add ribbon icon for reset
    this.addRibbonIcon('reset', 'Reset Vault Sync', () => {
      this.resetVault();
    });
    
    // Add command for reset
    this.addCommand({
      id: 'reset-vault-sync',
      name: 'Reset Vault Sync',
      callback: () => {
        this.resetVault();
      }
    });
    
    // Add settings tab
    this.addSettingTab(new VaultSyncSettingsTab(this.app, this));
    
    this.logger.info('main', 'Vault Sync Plugin loaded');
  }
  
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  
  async saveSettings() {
    await this.saveData(this.settings);
    
    // Update logger when settings change
    if (this.logger) {
      // Dispose old logger if needed
      await this.logger.dispose();
      this.logger = createLogger(this.settings);
    }
  }
  
  async resetVault() {
    try {
      if (!this.syncEngine || !this.logger) {
        return;
      }
      
      this.logger.info('main', 'Starting vault reset...');
      
      // Show notice
      new Notice('Resetting vault sync... This may take a moment.');
      
      // Call reset function
      await resetVault(this.app, this.syncEngine, this.settings, this.logger);


      
      // Show success notice
      new Notice('Vault sync reset complete!');
      
      this.logger.info('main', 'Vault reset completed successfully');
    } catch (error) {
      if (this.logger) {
        this.logger.error('main', `Failed to reset vault: ${error}`);
      }
      new Notice(`Failed to reset vault: ${error}`);
    }
  }
  
  async onunload() {
    // Clean up
    if (this.logger) {
      this.logger.info('main', 'Vault Sync Plugin unloaded');
      await this.logger.dispose();
    }
  }
}

class VaultSyncSettingsTab extends PluginSettingTab {
  plugin: VaultSyncPlugin;
  
  constructor(app: App, plugin: VaultSyncPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  
  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    
    containerEl.createEl('h2', { text: 'Vault Sync Settings' });
    
    // Target base path
    new Setting(containerEl)
      .setName('Target Base Path')
      .setDesc('The base directory where files will be copied to')
      .addText(text => {
        text
          .setPlaceholder('./target')
          .setValue(this.plugin.settings.targetBasePathUser)
          .onChange(async (value) => {
            this.plugin.settings = {
              ...this.plugin.settings,
              targetBasePathUser: value,
              targetBasePath: normalizeTargetPath(value, this.app.vault.getRoot().path)
            };
            await this.plugin.saveSettings();
          });
      });
    
    // Content path
    new Setting(containerEl)
      .setName('Content Path')
      .setDesc('Subdirectory for content files')
      .addText(text => {
        text
          .setPlaceholder('content')
          .setValue(this.plugin.settings.contentPathUser)
          .onChange(async (value) => {
            this.plugin.settings = {
              ...this.plugin.settings,
              contentPathUser: value,
              contentPath: normalizeSettingsPath(value)
            };
            await this.plugin.saveSettings();
          });
      });
    
    // Assets path
    new Setting(containerEl)
      .setName('Assets Path')
      .setDesc('Subdirectory for asset files')
      .addText(text => {
        text
          .setPlaceholder('public/_assets')
          .setValue(this.plugin.settings.assetsPathUser)
          .onChange(async (value) => {
            this.plugin.settings = {
              ...this.plugin.settings,
              assetsPathUser: value,
              assetsPath: normalizeSettingsPath(value)
            };
            await this.plugin.saveSettings();
          });
      });
    
    // Excluded paths
    new Setting(containerEl)
      .setName('Excluded Paths')
      .setDesc('Comma-separated list of paths to exclude from syncing')
      .addText(text => {
        text
          .setPlaceholder('.obsidian,.git,node_modules')
          .setValue(this.plugin.settings.excludePaths.join(','))
          .onChange(async (value) => {
            this.plugin.settings = { ...this.plugin.settings, excludePaths: value.split(',').map(p => p.trim()) };
            await this.plugin.saveSettings();
          });
      });

      // Exlcuded files
      new Setting(containerEl)
      .setName('Excluded Files')
      .setDesc('Comma-separated list of files to exclude from syncing')
      .addText(text => {
        text
          .setPlaceholder('*.md,*.png,*.jpg')
          .setValue(this.plugin.settings.excludeFiles.join(','))
          .onChange(async (value) => {
            this.plugin.settings = { ...this.plugin.settings, excludeFiles: value.split(',').map(p => p.trim()) };
            await this.plugin.saveSettings();
          });
      });
    
    // Debug mode
    new Setting(containerEl)
      .setName('Debug Mode')
      .setDesc('Enable verbose logging')
      .addToggle(toggle => {
        toggle
          .setValue(this.plugin.settings.debug)
          .onChange(async (value) => {
            this.plugin.settings = { ...this.plugin.settings, debug: value };
            await this.plugin.saveSettings();
          });
      });
      
    // Log to disk
    new Setting(containerEl)
      .setName('Log to Disk')
      .setDesc('Save logs to a file in the target directory')
      .addToggle(toggle => {
        toggle
          .setValue(this.plugin.settings.logToDisk)
          .onChange(async (value) => {
            this.plugin.settings = { ...this.plugin.settings, logToDisk: value };
            await this.plugin.saveSettings();
          });
      });
  }
}