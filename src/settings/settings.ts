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
      dialog: {
        showOpenDialog: (options: any) => Promise<{ canceled: boolean, filePaths: string[] }>
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

    // Automatically update vault path in settings if it's not set or different
    if (!this.plugin.settings.paths.vaultPath || this.plugin.settings.paths.vaultPath !== vaultPath) {
      this.plugin.settings.paths.vaultPath = vaultPath
      await this.plugin.saveSettings()
    }

    const isObsidianVault = await checkVaultFolder(vaultPath)

    // Website Path Section
    const websitePathInfo = await getWebsitePath(
      this.app.vault.adapter,
      this.plugin.settings.paths.type,
      this.plugin.settings.paths.websitePath,
    )

    // Update configuration status
    const hasPackageManager = !!websitePathInfo.runtime
    const isConfigured = isObsidianVault && websitePathInfo.status === 'valid' && hasPackageManager

    // Only update the configuration status, don't trigger a display refresh
    if (this.plugin.settings.paths.pathConfigured !== isConfigured) {
      this.plugin.settings.paths.pathConfigured = isConfigured
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
        text: '⚠ Folder found but no website detected!',
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
    this.plugin.settings.paths.type = value as 'none' | 'standard' | 'custom'

    // Reset path configuration when changing type
    if (value === 'none') {
      this.plugin.settings.paths.pathConfigured = false
    }

    await this.plugin.saveSettings()

    // Get current website path info for validation
    const websitePathInfo = await getWebsitePath(
      this.app.vault.adapter,
      this.plugin.settings.paths.type,
      this.plugin.settings.paths.websitePath,
    )

    // Update configuration status
    const hasPackageManager = !!websitePathInfo.runtime
    const isConfigured = websitePathInfo.status === 'valid' && hasPackageManager
    if (this.plugin.settings.paths.pathConfigured !== isConfigured) {
      this.plugin.settings.paths.pathConfigured = isConfigured
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
    this.plugin.settings.paths.websitePath = value
    await this.plugin.saveSettings()

    // Update paths display
    const pathsInfo = pathContent.querySelector('.ginko-web-settings-paths')
    if (pathsInfo instanceof HTMLElement) {
      await this.updatePathsDisplay(pathsInfo)
    }

    // Refresh display once
    this.display()
  }

  // Add method to handle folder selection
  private async handleFolderSelection(pathContent: HTMLElement): Promise<void> {
    // Use Electron's dialog to select folder
    const { dialog } = window.require('electron')
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select Website Folder',
      buttonLabel: 'Select Folder',
    })

    if (!result.canceled && result.filePaths.length > 0) {
      await this.handleCustomPathChange(result.filePaths[0], pathContent)
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

    // Step 0: Preparation
    const preparationStep = containerEl.createDiv('ginko-web-settings-step is-preparation')

    // Step Header
    const prepStepHeader = preparationStep.createDiv('ginko-web-settings-step-header')
    const prepStepNumber = prepStepHeader.createDiv('ginko-web-settings-step-number')
    prepStepNumber.setText('0')
    prepStepHeader.createDiv('ginko-web-settings-step-title').setText('Preparation')

    // Step Content
    const prepStepContent = preparationStep.createDiv('ginko-web-settings-step-content')
    prepStepContent.createDiv('ginko-web-settings-step-description')
      .setText('Before you begin, take a moment to prepare for a smooth setup experience')

    // Documentation Section
    const docsSection = prepStepContent.createDiv('ginko-web-settings-preparation-section')
    const docsTitle = docsSection.createDiv('ginko-web-settings-preparation-title')
    docsTitle.createSpan({ text: '📖' })
    docsTitle.createSpan({ text: 'Read our Documentation' })
    docsSection.createDiv('ginko-web-settings-preparation-content')
      .setText('Ginko Web once setup is a breeze to use. To avoid any mistakes during setup, please refer to our documentation.')
    const docsLink = docsSection.createEl('a', {
      cls: 'ginko-web-settings-preparation-button',
      href: 'https://ginko.build/docs/ginko-web/getting-started',
    })
    docsLink.createSpan({ text: '📚' })
    docsLink.createSpan({ text: 'View Documentation' })

    // Discord Section
    const discordSection = prepStepContent.createDiv('ginko-web-settings-preparation-section')
    const discordTitle = discordSection.createDiv('ginko-web-settings-preparation-title')
    discordTitle.createSpan({ text: '💬' })
    discordTitle.createSpan({ text: 'Join our Community' })
    discordSection.createDiv('ginko-web-settings-preparation-content')
      .setText('Join our Discord community for news, updates, and support. Get help from other users and stay up to date with the latest developments.')
    const discordLink = discordSection.createEl('a', {
      cls: 'ginko-web-settings-preparation-button',
      href: 'https://ginko.build/discord',
    })
    discordLink.createSpan({ text: '🎮' })
    discordLink.createSpan({ text: 'Join Discord' })

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
    })

    const usageOptions = stepContent.createDiv('ginko-web-settings-usage-options')

    // Personal Usage Option
    const personalOption = usageOptions.createDiv('ginko-web-settings-usage-option')
    personalOption.toggleClass('is-selected', this.plugin.settings.usage.type === 'personal')
    personalOption.createDiv('ginko-web-settings-usage-icon').setText('👤')
    personalOption.createDiv('ginko-web-settings-usage-title').setText('Personal')
    personalOption.createDiv('ginko-web-settings-usage-description')
      .setText('For individual use and personal projects')

    // Add feature list for Personal
    const personalFeatures = personalOption.createDiv('ginko-web-settings-usage-features')
    const personalList = personalFeatures.createEl('ul')
    const personalFeatureItems = [
      'All core features',
      'Community support',
      'Unlimited personal sites',
    ]
    personalFeatureItems.forEach((feature) => {
      const li = personalList.createEl('li')
      li.setText(feature)
    })

    // Commercial Usage Option
    const commercialOption = usageOptions.createDiv('ginko-web-settings-usage-option')
    commercialOption.toggleClass('is-selected', this.plugin.settings.usage.type === 'commercial')
    commercialOption.createDiv('ginko-web-settings-usage-icon').setText('🏢')
    commercialOption.createDiv('ginko-web-settings-usage-title').setText('Commercial')
    commercialOption.createDiv('ginko-web-settings-usage-description')
      .setText('For business and commercial use')

    // Add feature list for Commercial
    const commercialFeatures = commercialOption.createDiv('ginko-web-settings-usage-features')
    const commercialList = commercialFeatures.createEl('ul')
    const commercialFeatureItems = [
      'All core features',
      'Unlimited commercial sites',
      'Access to Screencasts',
      'Basic Support',
    ]
    commercialFeatureItems.forEach((feature) => {
      const li = commercialList.createEl('li')
      li.setText(feature)
    })

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
    frameworkStep.toggleClass('is-active', this.plugin.settings.usage.isConfigured && !this.plugin.settings.paths.template)
    frameworkStep.toggleClass('is-completed', !!this.plugin.settings.paths.template)

    // Step Header
    const frameworkHeader = frameworkStep.createDiv('ginko-web-settings-step-header')
    const frameworkNumber = frameworkHeader.createDiv('ginko-web-settings-step-number')
    frameworkNumber.setText('2')
    frameworkHeader.createDiv('ginko-web-settings-step-title').setText('Choose your Framework')

    // Step Status
    if (this.plugin.settings.paths.template) {
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
    })

    // Framework dropdown
    new Setting(frameworkContent)
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
        dropdown.setValue(this.plugin.settings.paths.template || '')

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
          this.plugin.settings.paths.template = value
          await this.plugin.saveSettings()
          this.display()
        })
      })

    // Show selected template description if one is selected
    const selectedTemplate = WEBSITE_TEMPLATES.find(t => t.id === this.plugin.settings.paths.template)
    if (selectedTemplate) {
      frameworkContent.createDiv('ginko-web-settings-template-description')
        .setText(selectedTemplate.description)
    }

    // Step 3: Language Configuration
    const languageStep = containerEl.createDiv('ginko-web-settings-step')
    languageStep.addClass('is-required')
    languageStep.toggleClass('is-active', this.plugin.settings.usage.isConfigured
    && !!this.plugin.settings.paths.template
    && (this.plugin.settings.languages.type === 'none' || !this.plugin.settings.languages.mainLanguage))
    languageStep.toggleClass('is-completed', this.plugin.settings.languages.type !== 'none'
    && !!this.plugin.settings.languages.mainLanguage)

    // Step Header
    const languageHeader = languageStep.createDiv('ginko-web-settings-step-header')
    const languageNumber = languageHeader.createDiv('ginko-web-settings-step-number')
    languageNumber.setText('3')
    languageHeader.createDiv('ginko-web-settings-step-title').setText('Language Configuration')

    // Step Status
    if (this.plugin.settings.languages.mainLanguage) {
      const languageStatus = languageStep.createDiv('ginko-web-settings-step-status is-completed')
      languageStatus.innerHTML = '✓ Configured'
    }

    // Step Content
    const languageContent = languageStep.createDiv('ginko-web-settings-step-content')
    languageContent.createDiv('ginko-web-settings-step-description')
      .setText('Configure the language settings for your website')

    // Language Mode Selection
    const languageModeContainer = languageContent.createDiv('ginko-web-settings-language-mode')

    // Single Language Button
    const singleLanguageBtn = languageModeContainer.createDiv('ginko-web-settings-language-button')
    singleLanguageBtn.toggleClass('is-selected', this.plugin.settings.languages.type === 'single')
    singleLanguageBtn.createDiv('ginko-web-settings-language-icon').setText('🌐')
    singleLanguageBtn.createDiv('ginko-web-settings-language-title').setText('Single Language')
    singleLanguageBtn.createDiv('ginko-web-settings-language-description')
      .setText('Website will be in a single language')

    // Multi Language Button
    const multiLanguageBtn = languageModeContainer.createDiv('ginko-web-settings-language-button')
    multiLanguageBtn.toggleClass('is-selected', this.plugin.settings.languages.type === 'multi')
    multiLanguageBtn.createDiv('ginko-web-settings-language-icon').setText('🌍')
    multiLanguageBtn.createDiv('ginko-web-settings-language-title').setText('Multi Language')
    multiLanguageBtn.createDiv('ginko-web-settings-language-description')
      .setText('Website will support multiple languages')

    // Language Selection (only show if multi-language type is selected)
    if (this.plugin.settings.languages.type === 'multi') {
      new Setting(languageContent)
        .setName('Main Language')
        .setDesc('Enter the main language code (e.g., en, de, fr)')
        .addText((text) => {
          text
            .setPlaceholder('en')
            .setValue(this.plugin.settings.languages.mainLanguage)
            .onChange((value) => {
              // Just update the value without saving or refreshing
              this.plugin.settings.languages.mainLanguage = value.toLowerCase()
            })

          // Add blur handler to save settings
          const inputEl = text.inputEl
          inputEl.addEventListener('blur', async () => {
            await this.plugin.saveSettings()
            this.display()
          })

          return text
        })

      // Add secondary languages input
      new Setting(languageContent)
        .setName('Secondary Languages')
        .setDesc('Enter additional language codes (comma-separated)')
        .addText((text) => {
          text
            .setPlaceholder('de, fr, es')
            .setValue(this.plugin.settings.languages.secondaryLanguages.join(', '))
            .onChange((value) => {
              // Split by comma, trim whitespace, and filter out empty strings
              const languages = value.split(',')
                .map(lang => lang.trim().toLowerCase())
                .filter(lang => lang !== '')
              this.plugin.settings.languages.secondaryLanguages = languages
            })

          // Add blur handler to save settings
          const inputEl = text.inputEl
          inputEl.addEventListener('blur', async () => {
            await this.plugin.saveSettings()
            this.display()
          })

          return text
        })

      // Add helper text for language codes
      languageContent.createEl('div', {
        text: 'Common language codes: en (English), de (German), fr (French), es (Spanish), it (Italian), pt (Portuguese), ja (Japanese), zh (Chinese)',
        cls: 'ginko-web-settings-helper-text',
      })
    }

    // Event Listeners for Language Mode Buttons
    singleLanguageBtn.addEventListener('click', async () => {
      this.plugin.settings.languages.type = 'single'
      this.plugin.settings.languages.mainLanguage = 'en' // Default to English for single language
      this.plugin.settings.languages.secondaryLanguages = [] // Clear secondary languages
      await this.plugin.saveSettings()
      this.display()
    })

    multiLanguageBtn.addEventListener('click', async () => {
      this.plugin.settings.languages.type = 'multi'
      this.plugin.settings.languages.mainLanguage = '' // Reset language when switching to multi
      this.plugin.settings.languages.secondaryLanguages = [] // Reset secondary languages
      await this.plugin.saveSettings()
      this.display()
    })

    // Update step completion status based on type and language selection
    languageStep.toggleClass('is-active', this.plugin.settings.usage.isConfigured
    && !!this.plugin.settings.paths.template
    && (this.plugin.settings.languages.type === 'none'
      || (this.plugin.settings.languages.type === 'multi' && !this.plugin.settings.languages.mainLanguage)))
    languageStep.toggleClass('is-completed', (this.plugin.settings.languages.type === 'single')
    || (this.plugin.settings.languages.type === 'multi' && !!this.plugin.settings.languages.mainLanguage))

    // Step 4: Path Configuration
    const pathStep = containerEl.createDiv('ginko-web-settings-step')
    pathStep.addClass('is-required')

    // Get current website path info for validation
    getWebsitePath(
      this.app.vault.adapter,
      this.plugin.settings.paths.type,
      this.plugin.settings.paths.websitePath,
    ).then((websitePathInfo) => {
      const hasPackageManager = !!websitePathInfo.runtime

      // Update the configuration status
      const isConfigured = websitePathInfo.status === 'valid' && hasPackageManager
      if (this.plugin.settings.paths.pathConfigured !== isConfigured) {
        this.plugin.settings.paths.pathConfigured = isConfigured
        this.plugin.saveSettings()
      }

      // Update the active/completed states
      const isPathStepActive = this.plugin.settings.usage.isConfigured
        && !!this.plugin.settings.paths.template
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
    pathNumber.setText('4')
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
    })

    // Path Type Selection
    new Setting(pathContent)
      .setName('Website Location')
      .setDesc('Choose where to store your website files')
      .addDropdown(dropdown => dropdown
        .addOption('none', 'Choose location...')
        .addOption('standard', 'Standard (Next to vault)')
        .addOption('custom', 'Custom Path')
        .setValue(this.plugin.settings.paths.type)
        .onChange(async (value) => {
          await this.handlePathTypeChange(value, pathContent)
        }))

    // Show custom path options if custom is selected
    if (this.plugin.settings.paths.type === 'custom') {
      const customPathSetting = new Setting(pathContent)
        .setClass('ginko-web-settings-indent')
        .setName('Custom Path')
        .setDesc('Select the folder for your website')
        .addButton(button => button
          .setButtonText('Select Folder')
          .onClick(async () => {
            await this.handleFolderSelection(pathContent)
          }))

      if (this.plugin.settings.paths.websitePath) {
        customPathSetting.setDesc(this.plugin.settings.paths.websitePath)
      }
    }

    // Show current paths info
    const pathsInfo = pathContent.createDiv('ginko-web-settings-paths')
    pathsInfo.addClass('ginko-web-settings-info-box')

    // Update paths display
    this.updatePathsDisplay(pathsInfo)

    // Step 5: Content Inclusion
    const inclusionStep = containerEl.createDiv('ginko-web-settings-step')
    inclusionStep.addClass('is-optional')
    inclusionStep.toggleClass('is-active', this.plugin.settings.paths.pathConfigured
    && (!this.plugin.settings.exclusions.ignoredFolders || !this.plugin.settings.exclusions.ignoredFiles))
    inclusionStep.toggleClass('is-completed', !!this.plugin.settings.exclusions.ignoredFolders || !!this.plugin.settings.exclusions.ignoredFiles)

    // Step Header
    const inclusionHeader = inclusionStep.createDiv('ginko-web-settings-step-header')
    const inclusionNumber = inclusionHeader.createDiv('ginko-web-settings-step-number')
    inclusionNumber.setText('5')
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

    // Step 6: Utilities Setup
    const utilitiesStep = containerEl.createDiv('ginko-web-settings-step')
    utilitiesStep.addClass('is-optional')
    utilitiesStep.toggleClass('is-active', this.plugin.settings.paths.pathConfigured
    && Object.values(this.plugin.settings.utilities).every(v => !v))
    utilitiesStep.toggleClass('is-completed', Object.values(this.plugin.settings.utilities).some(v => v))

    // Step Header
    const utilitiesHeader = utilitiesStep.createDiv('ginko-web-settings-step-header')
    const utilitiesNumber = utilitiesHeader.createDiv('ginko-web-settings-step-number')
    utilitiesNumber.setText('6')
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
