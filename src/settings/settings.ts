import type { App } from 'obsidian'
import type GinkoWebPlugin from '../main'
import type { GinkoScope } from './resetModal'
import { PluginSettingTab, Setting } from 'obsidian'
import { ResetModal } from './resetModal'
import { UTILITIES, WEBSITE_TEMPLATES } from './settingsConstants'
import { DEFAULT_SETTINGS } from './settingsTypes'
import { checkVaultFolder, getWebsitePath } from './settingsUtils'

export { DEFAULT_SETTINGS }

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
    console.log('🔄 updatePathsDisplay called')
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
    console.log('📊 websitePathInfo:', websitePathInfo)

    // Update configuration status
    const hasPackageManager = !!websitePathInfo.runtime
    const isConfigured = isObsidianVault && websitePathInfo.status === 'valid' && hasPackageManager
    console.log('⚙️ Configuration status:', {
      isObsidianVault,
      websitePathStatus: websitePathInfo.status,
      hasPackageManager,
      isConfigured,
      currentIsConfigured: this.plugin.settings.pathConfiguration.isConfigured,
    })

    // Only update the configuration status, don't trigger a display refresh
    if (this.plugin.settings.pathConfiguration.isConfigured !== isConfigured) {
      console.log('🔄 Updating configuration status:', isConfigured)
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

  // Add method to handle website location changes
  private async handlePathTypeChange(value: string, pathContent: HTMLElement): Promise<void> {
    console.log('🔄 Website Location changed:', value)
    this.plugin.settings.websitePath.type = value as 'none' | 'standard' | 'custom'

    // Reset path configuration when changing type
    if (value === 'none') {
      console.log('🔄 Resetting path configuration')
      this.plugin.settings.pathConfiguration.isConfigured = false
    }

    await this.plugin.saveSettings()

    // Get current website path info for validation
    const websitePathInfo = await getWebsitePath(
      this.app.vault.adapter,
      this.plugin.settings.websitePath.type,
      this.plugin.settings.websitePath.customPath,
      this.plugin.settings.websitePath.pathType,
    )

    // Update configuration status
    const hasPackageManager = !!websitePathInfo.runtime
    const isConfigured = websitePathInfo.status === 'valid' && hasPackageManager
    if (this.plugin.settings.pathConfiguration.isConfigured !== isConfigured) {
      this.plugin.settings.pathConfiguration.isConfigured = isConfigured
      await this.plugin.saveSettings()
    }

    // Update paths display
    const pathsInfo = pathContent.querySelector('.ginko-web-settings-paths')
    if (pathsInfo instanceof HTMLElement) {
      await this.updatePathsDisplay(pathsInfo)
    }

    // Refresh display once
    this.display()
  }

  // Add new method to handle custom path changes
  private async handleCustomPathChange(value: string, pathContent: HTMLElement): Promise<void> {
    this.plugin.settings.websitePath.customPath = value
    await this.plugin.saveSettings()

    // Update paths display
    const pathsInfo = pathContent.querySelector('.ginko-web-settings-paths')
    if (pathsInfo instanceof HTMLElement) {
      await this.updatePathsDisplay(pathsInfo)
    }

    // Refresh display once
    this.display()
  }

  // Add new method to handle path type changes
  private async handlePathTypeOptionChange(value: string, pathContent: HTMLElement): Promise<void> {
    this.plugin.settings.websitePath.pathType = value as 'relative' | 'absolute'
    await this.plugin.saveSettings()

    // Update paths display
    const pathsInfo = pathContent.querySelector('.ginko-web-settings-paths')
    if (pathsInfo instanceof HTMLElement) {
      await this.updatePathsDisplay(pathsInfo)
    }

    // Refresh display once
    this.display()
  }

  display(): void {
    console.log('🎨 Display called')
    const { containerEl } = this

    containerEl.empty()

    // Banner
    const bannerDiv = containerEl.createDiv('ginko-web-settings-banner')
    bannerDiv.createDiv('ginko-web-settings-logo')
    bannerDiv.createDiv('ginko-web-settings-title').setText('Ginko Web')
    bannerDiv.createDiv('ginko-web-settings-description')
      .setText('Enhance your notes with powerful block components')

    // Step 1: Usage Selection
    const usageStep = containerEl.createDiv('ginko-web-settings-step')
    usageStep.addClass('is-required')
    usageStep.toggleClass('is-active', !this.plugin.settings.usage.isConfigured)
    usageStep.toggleClass('is-completed', this.plugin.settings.usage.isConfigured)

    // Step Header
    const stepHeader = usageStep.createDiv('ginko-web-settings-step-header')
    const stepNumber = stepHeader.createDiv('ginko-web-settings-step-number')
    stepNumber.setText('1')
    stepHeader.createDiv('ginko-web-settings-step-title').setText('Usage Type')

    // Step Status
    if (this.plugin.settings.usage.isConfigured) {
      const stepStatus = usageStep.createDiv('ginko-web-settings-step-status is-completed')
      stepStatus.innerHTML = '✓ Configured'
    }

    // Step Content
    const stepContent = usageStep.createDiv('ginko-web-settings-step-content')
    stepContent.createDiv('ginko-web-settings-step-description')
      .setText('Choose how you plan to use Ginko Web')

    // Add documentation link above usage options
    stepContent.createEl('a', {
      text: '📖 Learn about licensing',
      href: 'https://ginko.build/docs/ginko-web/license',
      cls: 'ginko-web-settings-learn-link',
      target: '_blank',
    })

    const usageOptions = stepContent.createDiv('ginko-web-settings-usage-options')

    // Personal Usage Option
    const personalOption = usageOptions.createDiv('ginko-web-settings-usage-option')
    personalOption.toggleClass('is-selected', this.plugin.settings.usage.type === 'personal')
    personalOption.createDiv('ginko-web-settings-usage-icon').setText('👤')
    personalOption.createDiv('ginko-web-settings-usage-title').setText('Personal')
    personalOption.createDiv('ginko-web-settings-usage-description')
      .setText('For individual use and personal projects')

    // Commercial Usage Option
    const commercialOption = usageOptions.createDiv('ginko-web-settings-usage-option')
    commercialOption.toggleClass('is-selected', this.plugin.settings.usage.type === 'commercial')
    commercialOption.createDiv('ginko-web-settings-usage-icon').setText('🏢')
    commercialOption.createDiv('ginko-web-settings-usage-title').setText('Commercial')
    commercialOption.createDiv('ginko-web-settings-usage-description')
      .setText('For business and commercial use')

    // License Key Input
    const licenseInput = stepContent.createDiv('ginko-web-settings-license-input')
    licenseInput.toggleClass('is-visible', this.plugin.settings.usage.type === 'commercial')
    new Setting(licenseInput)
      .setName('License Key')
      .setDesc('Enter your commercial license key')
      .addText(text => text
        .setPlaceholder('XXXXX-XXXXX-XXXXX-XXXXX')
        .setValue(this.plugin.settings.usage.licenseKey || '')
        .onChange(async (value) => {
          this.plugin.settings.usage.licenseKey = value
          this.plugin.settings.usage.isConfigured = !!value
          await this.plugin.saveSettings()
          this.display()
        }))

    // Event Listeners for Usage Options
    personalOption.addEventListener('click', async () => {
      this.plugin.settings.usage.type = 'personal'
      this.plugin.settings.usage.isConfigured = true
      await this.plugin.saveSettings()
      this.display()
    })

    commercialOption.addEventListener('click', async () => {
      this.plugin.settings.usage.type = 'commercial'
      this.plugin.settings.usage.isConfigured = !!this.plugin.settings.usage.licenseKey
      await this.plugin.saveSettings()
      this.display()
    })

    // Step 2: Framework Selection
    const frameworkStep = containerEl.createDiv('ginko-web-settings-step')
    frameworkStep.addClass('is-required')
    frameworkStep.toggleClass('is-active', this.plugin.settings.usage.isConfigured && !this.plugin.settings.websitePath.template)
    frameworkStep.toggleClass('is-completed', !!this.plugin.settings.websitePath.template)

    // Step Header
    const frameworkHeader = frameworkStep.createDiv('ginko-web-settings-step-header')
    const frameworkNumber = frameworkHeader.createDiv('ginko-web-settings-step-number')
    frameworkNumber.setText('2')
    frameworkHeader.createDiv('ginko-web-settings-step-title').setText('Choose your Framework')

    // Step Status
    if (this.plugin.settings.websitePath.template) {
      const frameworkStatus = frameworkStep.createDiv('ginko-web-settings-step-status is-completed')
      frameworkStatus.innerHTML = '✓ Configured'
    }

    // Step Content
    const frameworkContent = frameworkStep.createDiv('ginko-web-settings-step-content')
    frameworkContent.createDiv('ginko-web-settings-step-description')
      .setText('Select the framework for your website')

    // Add documentation link
    frameworkContent.createEl('a', {
      text: '📖 Learn more about frameworks, templates & custom solutions',
      href: 'https://ginko.build/docs/frameworks',
      cls: 'ginko-web-settings-learn-link',
      target: '_blank',
    })

    // Framework dropdown
    const frameworkSetting = new Setting(frameworkContent)
      .setName('Framework & Template')
      .setDesc('Choose a framework and template for your site')

      .addDropdown((dropdown) => {
        // Add default option
        dropdown.addOption('', 'Select a framework...')

        // Add all templates
        WEBSITE_TEMPLATES.forEach((template) => {
          dropdown.addOption(template.id, template.name)
        })

        // Set current value
        dropdown.setValue(this.plugin.settings.websitePath.template || '')

        // Style the dropdown options with icons
        const dropdownEl = dropdown.selectEl

        // Add icons to options
        dropdownEl.querySelectorAll('option').forEach((option) => {
          const template = WEBSITE_TEMPLATES.find(t => t.id === option.value)
          if (template) {
            option.innerHTML = `${template.icon} ${template.name}`
            option.setAttribute('title', template.description)
          }
        })

        // Add change handler
        dropdown.onChange(async (value) => {
          this.plugin.settings.websitePath.template = value
          await this.plugin.saveSettings()
          this.display()
        })
      })

    // Show selected template description if one is selected
    const selectedTemplate = WEBSITE_TEMPLATES.find(t => t.id === this.plugin.settings.websitePath.template)
    if (selectedTemplate) {
      frameworkContent.createDiv('ginko-web-settings-template-description')
        .setText(selectedTemplate.description)
    }

    // Step 3: Path Configuration
    const pathStep = containerEl.createDiv('ginko-web-settings-step')
    pathStep.addClass('is-required')

    // Get current website path info for validation
    getWebsitePath(
      this.app.vault.adapter,
      this.plugin.settings.websitePath.type,
      this.plugin.settings.websitePath.customPath,
      this.plugin.settings.websitePath.pathType,
    ).then((websitePathInfo) => {
      const hasPackageManager = !!websitePathInfo.runtime

      // Update the configuration status
      const isConfigured = websitePathInfo.status === 'valid' && hasPackageManager
      if (this.plugin.settings.pathConfiguration.isConfigured !== isConfigured) {
        this.plugin.settings.pathConfiguration.isConfigured = isConfigured
        this.plugin.saveSettings()
      }

      console.log('🔍 Path Step Status:', {
        usage: this.plugin.settings.usage.isConfigured,
        template: !!this.plugin.settings.websitePath.template,
        pathConfigured: this.plugin.settings.pathConfiguration.isConfigured,
        hasPackageManager,
        websitePathStatus: websitePathInfo.status,
      })

      // Update the active/completed states
      const isPathStepActive = this.plugin.settings.usage.isConfigured
        && !!this.plugin.settings.websitePath.template
        && !isConfigured

      pathStep.toggleClass('is-active', isPathStepActive)
      pathStep.toggleClass('is-completed', isConfigured)

      // Step Status
      if (isConfigured) {
        const pathStatus = pathStep.createDiv('ginko-web-settings-step-status is-completed')
        pathStatus.innerHTML = '✓ Configured'
      }
    })

    // Step Header
    const pathHeader = pathStep.createDiv('ginko-web-settings-step-header')
    const pathNumber = pathHeader.createDiv('ginko-web-settings-step-number')
    pathNumber.setText('3')
    pathHeader.createDiv('ginko-web-settings-step-title').setText('Path Configuration')

    // Step Content
    const pathContent = pathStep.createDiv('ginko-web-settings-step-content')
    pathContent.createDiv('ginko-web-settings-step-description')
      .setText('Configure where your website files will be stored')

    // Add documentation link
    pathContent.createEl('a', {
      text: '📖 Learn more about path configuration',
      href: 'https://ginko.build/docs/setup/paths',
      cls: 'ginko-web-settings-learn-link',
      target: '_blank',
    })

    // Path Type Selection
    new Setting(pathContent)
      .setName('Website Location')
      .setDesc('Choose where to store your website files')
      .addDropdown(dropdown => dropdown
        .addOption('none', 'Choose location...')
        .addOption('standard', 'Standard (Next to vault)')
        .addOption('custom', 'Custom Path')
        .setValue(this.plugin.settings.websitePath.type)
        .onChange(async (value) => {
          await this.handlePathTypeChange(value, pathContent)
        }))

    // Show custom path options if custom is selected
    if (this.plugin.settings.websitePath.type === 'custom') {
      new Setting(pathContent)
        .setClass('ginko-web-settings-indent')
        .setName('Path Type')
        .addDropdown(dropdown => dropdown
          .addOption('relative', 'Relative to vault')
          .addOption('absolute', 'Absolute path')
          .setValue(this.plugin.settings.websitePath.pathType || 'relative')
          .onChange(async (value) => {
            await this.handlePathTypeOptionChange(value, pathContent)
          }))

      new Setting(pathContent)
        .setClass('ginko-web-settings-indent')
        .setName('Custom Path')
        .setDesc('Enter the path to your website folder')
        .addText(text => text
          .setPlaceholder('Enter path...')
          .setValue(this.plugin.settings.websitePath.customPath || '')
          .onChange(async (value) => {
            await this.handleCustomPathChange(value, pathContent)
          }))
    }

    // Show current paths info
    const pathsInfo = pathContent.createDiv('ginko-web-settings-paths')
    pathsInfo.addClass('ginko-web-settings-info-box')

    // Update paths display
    this.updatePathsDisplay(pathsInfo)

    // Step 4: Content Inclusion
    const inclusionStep = containerEl.createDiv('ginko-web-settings-step')
    inclusionStep.addClass('is-optional')
    inclusionStep.toggleClass('is-active', this.plugin.settings.pathConfiguration.isConfigured
      && (!this.plugin.settings.exclusions.ignoredFolders || !this.plugin.settings.exclusions.ignoredFiles))
    inclusionStep.toggleClass('is-completed', !!this.plugin.settings.exclusions.ignoredFolders || !!this.plugin.settings.exclusions.ignoredFiles)

    // Step Header
    const inclusionHeader = inclusionStep.createDiv('ginko-web-settings-step-header')
    const inclusionNumber = inclusionHeader.createDiv('ginko-web-settings-step-number')
    inclusionNumber.setText('4')
    inclusionHeader.createDiv('ginko-web-settings-step-title').setText('Content Settings')

    // Step Content
    const inclusionContent = inclusionStep.createDiv('ginko-web-settings-step-content')
    inclusionContent.createDiv('ginko-web-settings-step-description')
      .setText('Configure which content to include in your website')

    // Add documentation link
    inclusionContent.createEl('a', {
      text: '📖 Learn about content configuration',
      href: 'https://ginko.build/docs/setup/content',
      cls: 'ginko-web-settings-learn-link',
    })

    // Exclusions Settings
    new Setting(inclusionContent)
      .setName('Ignored Folders')
      .setDesc('Folders to exclude from processing (comma-separated)')
      .addTextArea(text => text
        .setPlaceholder('private, templates, archive')
        .setValue(this.plugin.settings.exclusions.ignoredFolders)
        .onChange(async (value) => {
          this.plugin.settings.exclusions.ignoredFolders = value
          await this.plugin.saveSettings()
        }))

    new Setting(inclusionContent)
      .setName('Ignored Files')
      .setDesc('Files to exclude from processing (comma-separated)')
      .addTextArea(text => text
        .setPlaceholder('draft.md, todo.md')
        .setValue(this.plugin.settings.exclusions.ignoredFiles)
        .onChange(async (value) => {
          this.plugin.settings.exclusions.ignoredFiles = value
          await this.plugin.saveSettings()
        }))

    // Step 5: Utilities Setup
    const utilitiesStep = containerEl.createDiv('ginko-web-settings-step')
    utilitiesStep.addClass('is-optional')
    utilitiesStep.toggleClass('is-active', this.plugin.settings.pathConfiguration.isConfigured
      && Object.values(this.plugin.settings.utilities).every(v => !v))
    utilitiesStep.toggleClass('is-completed', Object.values(this.plugin.settings.utilities).some(v => v))

    // Step Header
    const utilitiesHeader = utilitiesStep.createDiv('ginko-web-settings-step-header')
    const utilitiesNumber = utilitiesHeader.createDiv('ginko-web-settings-step-number')
    utilitiesNumber.setText('5')
    utilitiesHeader.createDiv('ginko-web-settings-step-title').setText('Optional Utilities')

    // Step Content
    const utilitiesContent = utilitiesStep.createDiv('ginko-web-settings-step-content')
    utilitiesContent.createDiv('ginko-web-settings-step-description')
      .setText('Enable additional features to enhance your workflow')

    // Add documentation link
    utilitiesContent.createEl('a', {
      text: '📖 Learn about available utilities',
      href: 'https://ginko.build/docs/utilities',
      cls: 'ginko-web-settings-learn-link',
    })

    // Add utilities
    UTILITIES.forEach((utility) => {
      const setting = new Setting(utilitiesContent)
        .setName(utility.name)
        .setDesc(createFragment((el) => {
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
        .addToggle(toggle => toggle
          .setValue(this.plugin.settings.utilities[utility.id])
          .onChange(async (value) => {
            this.plugin.settings.utilities[utility.id] = value
            await this.plugin.saveSettings()
          }))
    })

    // Debug Section
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
