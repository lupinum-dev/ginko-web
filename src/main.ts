// src/main.ts
import { Plugin, PluginSettingTab, App, Setting } from 'obsidian';
import { ObsidianAdapter } from './adapters/obsidian-adapter';
import { SyncSettings, DEFAULT_SETTINGS } from './types';

export default class VaultSyncPlugin extends Plugin {
  settings: SyncSettings;
  private adapter: ObsidianAdapter;
  
  async onload() {
    // Load settings
    await this.loadSettings();
    
    // Initialize adapter - will automatically set up file watchers
    console.log('Initializing adapter');
    this.adapter = new ObsidianAdapter(this, this.app, this.settings);
    
    // Add settings tab
    this.addSettingTab(new VaultSyncSettingTab(this.app, this));
    
    console.log('Vault Sync Plugin loaded');
  }
  
  async loadSettings() {
    const loadedData = await this.loadData();
    
    // Start with default settings
    this.settings = { ...DEFAULT_SETTINGS };
    
    // If we have loaded data, merge it with defaults
    if (loadedData) {
      // Copy primitive values directly
      this.settings.targetBasePath = loadedData.targetBasePath || DEFAULT_SETTINGS.targetBasePath;
      this.settings.contentPath = loadedData.contentPath || DEFAULT_SETTINGS.contentPath;
      this.settings.assetsPath = loadedData.assetsPath || DEFAULT_SETTINGS.assetsPath;
      this.settings.debugMode = loadedData.debugMode !== undefined ? loadedData.debugMode : DEFAULT_SETTINGS.debugMode;
      
      // Ensure excludePaths is always an array
      this.settings.excludePaths = Array.isArray(loadedData.excludePaths) 
        ? loadedData.excludePaths 
        : DEFAULT_SETTINGS.excludePaths;
      
      // Ensure activeRules is always an array
      this.settings.activeRules = Array.isArray(loadedData.activeRules) 
        ? loadedData.activeRules 
        : DEFAULT_SETTINGS.activeRules;
    }
    
    console.log('Settings loaded:', this.settings);
  }
  
  async saveSettings() {
    await this.saveData(this.settings);
    
    // Update adapter settings
    if (this.adapter) {
      this.adapter.updateSettings(this.settings);
    }
  }
}

class VaultSyncSettingTab extends PluginSettingTab {
  plugin: VaultSyncPlugin;
  
  constructor(app: App, plugin: VaultSyncPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  
  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    
    containerEl.createEl('h2', { text: 'Vault Sync Settings' });
    
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
    
    new Setting(containerEl)
      .setName('Excluded Paths')
      .setDesc('Comma-separated list of paths to exclude from syncing')
      .addText(text => {
        // Make sure excludePaths is always an array before joining
        const excludePathsValue = Array.isArray(this.plugin.settings.excludePaths)
          ? this.plugin.settings.excludePaths.join(',')
          : '.obsidian,.git,node_modules';
        
        text
          .setPlaceholder('.obsidian,.git,node_modules')
          .setValue(excludePathsValue)
          .onChange(async (value) => {
            this.plugin.settings.excludePaths = value.split(',').map(p => p.trim());
            await this.plugin.saveSettings();
          });
      });
    
    // Rules settings
    containerEl.createEl('h3', { text: 'Rules' });
    
    new Setting(containerEl)
      .setName('Active Rules')
      .setDesc('Select which rules to apply (in order of priority)')
      .addDropdown(dropdown => {
        // Add available rules
        dropdown.addOption('generic', 'Generic Rule');
        dropdown.addOption('language', 'Language Rule');
        
        // Ensure activeRules is an array
        if (!Array.isArray(this.plugin.settings.activeRules)) {
          this.plugin.settings.activeRules = ['generic'];
        }
        
        // Set current selection
        if (this.plugin.settings.activeRules.includes('generic')) {
          dropdown.setValue('generic');
        } else if (this.plugin.settings.activeRules.includes('language')) {
          dropdown.setValue('language');
        }
        
        dropdown.onChange(async (value) => {
          // Add the selected rule if not already active
          if (!this.plugin.settings.activeRules.includes(value)) {
            this.plugin.settings.activeRules.push(value);
            await this.plugin.saveSettings();
          }
          
          // Refresh display to show current active rules
          this.display();
        });
      });
    
    // Display active rules as pills that can be removed
    const rulesContainer = containerEl.createDiv('active-rules');
    rulesContainer.addClass('settings-active-rules');
    
    const ruleDescriptions: Record<string, string> = {
      'generic': 'Generic Rule - Basic path preservation',
      'language': 'Language Rule - Process files with __lang suffix'
    };
    
    // Ensure activeRules is an array
    if (Array.isArray(this.plugin.settings.activeRules)) {
      for (const ruleName of this.plugin.settings.activeRules) {
        const pillEl = rulesContainer.createDiv('active-rule-pill');
        
        pillEl.createSpan({
          text: ruleDescriptions[ruleName] || ruleName
        });
        
        // Add remove button
        const removeBtn = pillEl.createSpan({
          text: '×',
          cls: 'remove-rule-btn'
        });
        
        removeBtn.addEventListener('click', async () => {
          // Remove the rule
          this.plugin.settings.activeRules = this.plugin.settings.activeRules.filter(
            name => name !== ruleName
          );
          
          await this.plugin.saveSettings();
          
          // Refresh display
          this.display();
        });
      }
    }
    
    // Add some CSS for the pills
    const style = document.createElement('style');
    style.textContent = `
      .settings-active-rules {
        margin-top: 8px;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .active-rule-pill {
        background-color: var(--interactive-accent);
        color: var(--text-on-accent);
        padding: 4px 8px;
        border-radius: 16px;
        display: flex;
        align-items: center;
      }
      .remove-rule-btn {
        margin-left: 8px;
        cursor: pointer;
        font-weight: bold;
      }
    `;
    containerEl.appendChild(style);
    
    new Setting(containerEl)
      .setName('Debug Mode')
      .setDesc('Enable verbose logging')
      .addToggle(toggle => {
        toggle
          .setValue(this.plugin.settings.debugMode)
          .onChange(async (value) => {
            this.plugin.settings.debugMode = value;
            await this.plugin.saveSettings();
          });
      });
      
    // Add help text about language processing
    const helpDiv = containerEl.createDiv('language-help');
    helpDiv.addClass('setting-item-description');
    helpDiv.innerHTML = `
      <p><strong>Language Files:</strong> Any file with a name in the format <code>filename__lang.md</code> 
      (e.g., <code>note__de.md</code>, <code>post__zh.md</code>) will be automatically processed and placed in
      the corresponding language folder (e.g., <code>/content/de/note.md</code>).</p>
    `;
  }
}