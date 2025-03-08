// src/main.ts
import { Plugin, PluginSettingTab, App, Setting } from 'obsidian';
import { setupObsidianSync } from './adapters/obsidian-adapter';
import { SyncEngine } from './core/sync-engine';
import { DEFAULT_SETTINGS, SyncSettings } from './types';

export default class VaultSyncPlugin extends Plugin {
  settings: SyncSettings;
  private syncEngine: SyncEngine;
  
  async onload() {
    // Load settings
    await this.loadSettings();
    
    // Initialize sync engine
    this.syncEngine = setupObsidianSync(this, this.app, this.settings);
    
    // Add settings tab
    this.addSettingTab(new VaultSyncSettingsTab(this.app, this));
    
    console.log('Vault Sync Plugin loaded');
  }
  
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  
  async saveSettings() {
    await this.saveData(this.settings);
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
      
  }
}