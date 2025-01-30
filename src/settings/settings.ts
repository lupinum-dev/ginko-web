import type { App } from 'obsidian'
import type GinkoWebPlugin from '../main'
import type { GinkoScope } from './resetModal'
import { PluginSettingTab, Setting } from 'obsidian'
import { ResetModal } from './resetModal'
import { UTILITIES, WEBSITE_TEMPLATES } from './settingsConstants'
import { checkVaultFolder, getWebsitePath } from './settingsUtils'

// Declare the electron shell type
declare global {
  interface Window {
    require: (module: 'electron') => {
      shell: {
        openPath: (path: string) => Promise<string>
      }
    }
  }
}

export class GinkoWebSettingTab extends PluginSettingTab {
  plugin: GinkoWebPlugin

  constructor(app: App, plugin: GinkoWebPlugin) {
    super(app, plugin)
    this.plugin = plugin
  }

  private createCopyButton(text: string): HTMLElement {
    const button = createEl('button')
    button.addClass('ginko-web-settings-copy-btn')
    const icon = createEl('span')
    icon.addClass('ginko-web-settings-copy-icon')
    icon.setText('📋')
    button.appendChild(icon)
    button.addEventListener('click', async () => {
      await navigator.clipboard.writeText(text)
      icon.setText('✓')
      setTimeout(() => {
        icon.setText('📋')
      }, 2000)
    })
    return button
  }

  private createOpenButton(path: string): HTMLElement {
    const button = createEl('button')
    button.addClass('ginko-web-settings-open-btn')
    const icon = createEl('span')
    icon.setText('📂')
    button.appendChild(icon)
    button.addEventListener('click', async () => {
      const { shell } = window.require('electron')
      await shell.openPath(path)
    })
    return button
  }

  private async updatePathsDisplay(pathsDiv: HTMLElement): Promise<void> {
    pathsDiv.empty()
    pathsDiv.createEl('h3', { text: 'Current Configuration' })

    // Vault Path Section
    const vaultPath = (this.app.vault.adapter as any).getBasePath()
    const isObsidianVault = await checkVaultFolder(vaultPath)

    // Website Path Section
    const websitePathInfo = await getWebsitePath(
      this.app.vault.adapter,
      this.plugin.settings.websitePath.type,
      this.plugin.settings.websitePath.customPath,
      this.plugin.settings.websitePath.pathType,
    )

    // Update configuration status
    const isConfigured = isObsidianVault && websitePathInfo.status === 'valid'
    if (this.plugin.settings.pathConfiguration.isConfigured !== isConfigured) {
      this.plugin.settings.pathConfiguration.isConfigured = isConfigured
      await this.plugin.saveSettings()
    }

    // Create vault path section
    const vaultPathDiv = pathsDiv.createDiv('ginko-web-settings-path-item')
    const vaultPathHeader = vaultPathDiv.createDiv('ginko-web-settings-path-header')
    const vaultHeaderLeft = vaultPathHeader.createDiv('ginko-web-settings-path-header-left')
    vaultHeaderLeft.createSpan({ text: 'Vault Path: ', cls: 'ginko-web-settings-path-label' })

    if (isObsidianVault) {
      vaultHeaderLeft.createSpan({
        cls: 'ginko-web-settings-runtime-badge mod-obsidian',
        text: 'OBSIDIAN',
      })
    }

    const vaultButtonsDiv = vaultPathHeader.createDiv('ginko-web-settings-path-buttons')
    vaultButtonsDiv.appendChild(this.createCopyButton(vaultPath))
    vaultButtonsDiv.appendChild(this.createOpenButton(vaultPath))

    vaultPathDiv.createDiv({
      text: vaultPath,
      cls: 'ginko-web-settings-path-value mod-valid',
    })

    // Create website path section
    const websitePathDiv = pathsDiv.createDiv('ginko-web-settings-path-item')
    const websitePathHeader = websitePathDiv.createDiv('ginko-web-settings-path-header')
    const websiteHeaderLeft = websitePathHeader.createDiv('ginko-web-settings-path-header-left')
    websiteHeaderLeft.createSpan({ text: 'Website Path: ', cls: 'ginko-web-settings-path-label' })

    if (websitePathInfo.runtime) {
      websiteHeaderLeft.createSpan({
        cls: `ginko-web-settings-runtime-badge mod-${websitePathInfo.runtime}`,
        text: websitePathInfo.runtime.toUpperCase(),
      })
    }

    const websiteButtonsDiv = websitePathHeader.createDiv('ginko-web-settings-path-buttons')
    if (websitePathInfo.path !== '<Not set>' && websitePathInfo.path !== '<Not configured>') {
      websiteButtonsDiv.appendChild(this.createCopyButton(websitePathInfo.path))
      websiteButtonsDiv.appendChild(this.createOpenButton(websitePathInfo.path))
    }

    websitePathDiv.createDiv({
      text: websitePathInfo.path,
      cls: `ginko-web-settings-path-value ${websitePathInfo.status ? `mod-${websitePathInfo.status}` : ''}`,
    })

    // Add status messages
    const statusDiv = pathsDiv.createDiv('ginko-web-settings-path-status')
    if (isConfigured) {
      statusDiv.createDiv({
        text: '✓ Configuration valid - Ready to use Ginko',
        cls: 'ginko-web-settings-status-message mod-valid',
      })
    }
    else if (websitePathInfo.status === 'warning') {
      statusDiv.createDiv({
        text: '⚠ Website folder found but no package manager detected',
        cls: 'ginko-web-settings-status-message mod-warning',
      })
    }
    else {
      statusDiv.createDiv({
        text: '✕ Website path not properly configured',
        cls: 'ginko-web-settings-status-message mod-error',
      })
    }
  }

  display(): void {
    const { containerEl } = this

    containerEl.empty()

    // Banner
    const bannerDiv = containerEl.createDiv('ginko-web-settings-banner')
    bannerDiv.createDiv('ginko-web-settings-logo')
    bannerDiv.createDiv('ginko-web-settings-title').setText('Ginko Web')
    bannerDiv.createDiv('ginko-web-settings-description')
      .setText('Enhance your notes with powerful block components')

    // Documentation Area
    containerEl.createEl('h2', { text: 'Documentation' })
    const docDiv = containerEl.createDiv('ginko-web-settings-documentation')
    docDiv.createEl('p', {
      text: 'Please refer to our comprehensive documentation to get the most out of Ginko Web. We have detailed guides on component usage, examples, and best practices.',
    })
    new Setting(docDiv)
      .addButton(button => button
        .setButtonText('📚 Read Documentation')
        .setCta()
        .onClick(() => {
          window.open('https://ginko-web.com/docs', '_blank')
        }))

    // Discord Community
    containerEl.createEl('h2', { text: 'Join Our Community' })
    const discordDiv = containerEl.createDiv('ginko-web-settings-discord')
    const discordList = discordDiv.createEl('ul')
    const discordItems = [
      'Get help and support',
      'Stay updated on new features',
    ]
    discordItems.forEach((item) => {
      discordList.createEl('li', { text: item })
    })
    new Setting(discordDiv)
      .addButton(button => button
        .setButtonText('🎮 Join Discord')
        .setCta()
        .onClick(() => {
          window.open('https://discord.gg/SSGK5tuqJh', '_blank')
        }))

    // Setup Section
    containerEl.createEl('h2', { text: 'Setup' })

    // Website Path Settings
    new Setting(containerEl)
      .setName('Website Folder Location')
      .setDesc(createFragment((el) => {
        el.createSpan({ text: 'Define where your website folder will be located. ' })
        el.createEl('a', {
          text: 'Learn more about paths',
          href: 'https://ginko-web.com/docs/setup/paths',
          cls: 'ginko-web-settings-inline-link',
        })
      }))
      .addDropdown(dropdown => dropdown
        .addOption('none', 'Choose location type...')
        .addOption('standard', 'Standard (Next to Ginko folder)')
        .addOption('custom', 'Custom Path')
        .setValue(this.plugin.settings.websitePath.type)
        .onChange(async (value) => {
          this.plugin.settings.websitePath.type = value as 'none' | 'standard' | 'custom'
          await this.plugin.saveSettings()
          this.display()
        }))

    // Create paths display div early
    const pathsDiv = containerEl.createDiv('ginko-web-settings-paths')
    pathsDiv.addClass('ginko-web-settings-info-box')

    // Add custom path settings if custom path is selected
    if (this.plugin.settings.websitePath.type === 'custom') {
      new Setting(containerEl)
        .setClass('ginko-web-settings-indent')
        .setName('Path Type')
        .addDropdown(dropdown => dropdown
          .addOption('relative', 'Relative to vault')
          .addOption('absolute', 'Absolute path')
          .setValue(this.plugin.settings.websitePath.pathType || 'relative')
          .onChange(async (value) => {
            this.plugin.settings.websitePath.pathType = value as 'relative' | 'absolute'
            await this.plugin.saveSettings()
            await this.updatePathsDisplay(pathsDiv)
          }))

      new Setting(containerEl)
        .setClass('ginko-web-settings-indent')
        .setName('Custom Path')
        .setDesc('Enter the path to your website folder')
        .addText(text => text
          .setPlaceholder('Enter path...')
          .setValue(this.plugin.settings.websitePath.customPath || '')
          .onChange(async (value) => {
            this.plugin.settings.websitePath.customPath = value
            await this.plugin.saveSettings()
            await this.updatePathsDisplay(pathsDiv)
          }))
    }

    // Add Website Template Settings
    if (this.plugin.settings.websitePath.type) {
      new Setting(containerEl)
        .setClass('ginko-web-settings-indent')
        .setName('Website Template')
        .setDesc('Choose a predefined template for your website')
        .addDropdown((dropdown) => {
          dropdown.addOption('', 'Select a template...')
          WEBSITE_TEMPLATES.forEach((template) => {
            dropdown.addOption(template.id, template.name)
          })
          dropdown.onChange(async (value) => {
            if (!value)
              return
            this.plugin.settings.websitePath.template = value
            await this.plugin.saveSettings()
          })

          // Set initial value from settings
          dropdown.setValue(this.plugin.settings.websitePath.template || '')

          // Add template icons and descriptions
          const dropdownEl = dropdown.selectEl
          dropdownEl.querySelectorAll('option').forEach((option) => {
            const template = WEBSITE_TEMPLATES.find(t => t.id === option.value)
            if (template) {
              option.innerHTML = `${template.icon} ${template.name}`
              option.setAttribute('title', template.description)
            }
          })
        })
    }

    // Update paths display
    this.updatePathsDisplay(pathsDiv)

    // Language Settings
    new Setting(containerEl)
      .setName('Multiple Languages')
      .setDesc('Enable support for multiple languages')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.languages.multipleLanguages)
        .onChange(async (value) => {
          this.plugin.settings.languages.multipleLanguages = value
          await this.plugin.saveSettings()
          this.display()
        }))

    if (this.plugin.settings.languages.multipleLanguages) {
      new Setting(containerEl)
        .setClass('ginko-web-settings-indent')
        .setName('Main Language')
        .setDesc('Set your main language (e.g., en, es, fr)')
        .addText(text => text
          .setPlaceholder('en')
          .setValue(this.plugin.settings.languages.mainLanguage)
          .onChange(async (value) => {
            this.plugin.settings.languages.mainLanguage = value
            await this.plugin.saveSettings()
          }))
    }

    // Exclusions Settings
    containerEl.createEl('h3', { text: 'Exclusions' })

    new Setting(containerEl)
      .setName('Ignored Folders')
      .setDesc('Folders to exclude from processing (comma-separated)')
      .addTextArea(text => text
        .setPlaceholder('folder1, folder2, folder3')
        .setValue(this.plugin.settings.exclusions.ignoredFolders)
        .onChange(async (value) => {
          this.plugin.settings.exclusions.ignoredFolders = value
          await this.plugin.saveSettings()
        }))

    new Setting(containerEl)
      .setName('Ignored Files')
      .setDesc('Files to exclude from processing (comma-separated)')
      .addTextArea(text => text
        .setPlaceholder('file1.md, file2.md')
        .setValue(this.plugin.settings.exclusions.ignoredFiles)
        .onChange(async (value) => {
          this.plugin.settings.exclusions.ignoredFiles = value
          await this.plugin.saveSettings()
        }))

    // Add Utilities Section
    containerEl.createEl('h2', { text: 'Utilities' })

    // Add Changelog Section
    new Setting(containerEl)
      .setName('Changelog & Updates')
      .setDesc('View the latest changes and updates to Ginko Web')
      .addButton(button => button
        .setButtonText('Show Welcome & Changelog')
        .onClick(async () => {
          await this.plugin.activateWelcomeView(true)
        }))

    // Add utilities
    UTILITIES.forEach((utility) => {
      const setting = new Setting(containerEl)
      setting.setName(utility.name)
      setting.setDesc(createFragment((el) => {
        // Create main description container
        const descContainer = el.createDiv({ cls: 'ginko-web-settings-description-container' })

        // Add main description text
        descContainer.createDiv({
          text: utility.description,
          cls: 'ginko-web-settings-utility-description',
        })

        // Add warning text if present
        if (utility.warning) {
          descContainer.createDiv({
            text: utility.warning,
            cls: ['ginko-web-settings-warning', 'mod-warning'],
          })
        }

        // Add links if present
        if (utility.links && utility.links.length > 0) {
          const linksContainer = descContainer.createDiv({ cls: 'ginko-web-settings-links-container' })
          utility.links.forEach((link) => {
            linksContainer.createEl('a', {
              text: link.text,
              cls: 'ginko-web-settings-doc-link',
              href: link.url,
            })
          })
        }
      }))
      setting.addToggle(toggle => toggle
        .setValue(this.plugin.settings.utilities[utility.id])
        .onChange(async (value) => {
          this.plugin.settings.utilities[utility.id] = value
          await this.plugin.saveSettings()
        }))
    })

    // Add Debug Section
    containerEl.createEl('h2', { text: 'Debug' })

    new Setting(containerEl)
      .setName('Show Current Settings')
      .setDesc('Display and copy the current plugin settings')
      .addToggle(toggle => toggle
        .setValue(false)
        .onChange((value) => {
          const debugSection = containerEl.querySelector('.ginko-web-settings-debug-section')
          if (debugSection instanceof HTMLElement)
            debugSection.style.display = value ? 'block' : 'none'
        }))

    // Create debug section
    const debugSection = containerEl.createDiv('ginko-web-settings-debug-section')
    debugSection.style.display = 'none'

    // Create settings display
    const settingsDisplay = debugSection.createEl('pre', {
      cls: 'ginko-web-settings-debug-content',
      text: JSON.stringify(this.plugin.settings, null, 2),
    })

    // Create button container
    const buttonContainer = debugSection.createDiv('ginko-web-settings-debug-buttons')

    // Add refresh button
    const refreshButton = createEl('button', {
      cls: 'ginko-web-settings-debug-button',
      text: '🔄 Refresh',
    })
    buttonContainer.appendChild(refreshButton)

    refreshButton.addEventListener('click', () => {
      settingsDisplay.setText(JSON.stringify(this.plugin.settings, null, 2))
      refreshButton.setText('🔄 Refreshed!')
      setTimeout(() => {
        refreshButton.setText('🔄 Refresh')
      }, 2000)
    })

    // Add copy button
    const copyButton = createEl('button', {
      cls: 'ginko-web-settings-debug-button',
      text: '📋 Copy Settings',
    })
    buttonContainer.appendChild(copyButton)

    copyButton.addEventListener('click', async () => {
      await navigator.clipboard.writeText(JSON.stringify(this.plugin.settings, null, 2))
      copyButton.setText('📋 Copied!')
      setTimeout(() => {
        copyButton.setText('📋 Copy Settings')
      }, 2000)
    })
  }

  private showResetConfirmation(component: string, scope: GinkoScope): void {
    new ResetModal(
      this.app,
      component,
      scope,
      () => {
        // TODO: Implement actual reset logic here
      },
    ).open()
  }
}
