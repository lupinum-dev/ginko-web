// src/main.ts
import { Plugin, PluginSettingTab, App, Setting, Notice } from 'obsidian';
import { setupObsidianSync } from './adapters/obsidian-adapter';
import { SyncEngine } from './core/sync-engine';
import { DEFAULT_SETTINGS, SyncSettings } from './types';
import { Logger } from './utils/logger';
import { resetVault } from './core/reset-vault';

export default class VaultSyncPlugin extends Plugin {
  settings: SyncSettings;
  private syncEngine: SyncEngine;
  private logger: Logger;
  
  async onload() {
    // Load settings
    await this.loadSettings();
    
    // Initialize logger
    this.logger = new Logger(this.settings);
    this.logger.info('main.ts', 'Initializing Vault Sync Plugin');
    
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
    
    this.logger.info('main.ts', 'Vault Sync Plugin loaded');
  }
  
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  
  async saveSettings() {
    await this.saveData(this.settings);
    
    // Update logger when settings change
    if (this.logger) {
      this.logger = new Logger(this.settings);
    }
  }
  
  async resetVault() {
    try {
      this.logger.info('main.ts', 'Starting vault reset...');
      
      // Show notice
      new Notice('Resetting vault sync... This may take a moment.');
      
      // Call reset function
      await resetVault(this.app, this.syncEngine, this.settings, this.logger);
      
      // Show success notice
      new Notice('Vault sync reset complete!');
      
      this.logger.info('main.ts', 'Vault reset completed successfully');
    } catch (error) {
      this.logger.error('main.ts', `Failed to reset vault: ${error}`);
      new Notice(`Failed to reset vault: ${error}`);
    }
  }
  
  onunload() {
    // Clean up
    if (this.logger) {
      this.logger.dispose();
    }
    this.logger.info('main.ts', 'Vault Sync Plugin unloaded');
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
          .setValue(this.plugin.settings.targetBasePath)
          .onChange(async (value) => {
            this.plugin.settings.targetBasePath = value;
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
          .setValue(this.plugin.settings.contentPath)
          .onChange(async (value) => {
            this.plugin.settings.contentPath = value;
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
          .setValue(this.plugin.settings.assetsPath)
          .onChange(async (value) => {
            this.plugin.settings.assetsPath = value;
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
            this.plugin.settings.excludePaths = value.split(',').map(p => p.trim());
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
            this.plugin.settings.debug = value;
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
            this.plugin.settings.logToDisk = value;
            await this.plugin.saveSettings();
          });
      });
  }
}