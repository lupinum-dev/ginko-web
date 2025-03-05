import type { App } from 'obsidian'
import type { GinkoWebSettings } from '../../settings/settingsTypes'
import { Modal, Setting } from 'obsidian'

interface LanguageSlug {
  code: string
  slug: string
}

interface ColocationSettings {
  title: string
  slugs: LanguageSlug[]
  useTemplate: boolean
  sourceFile?: {
    path: string
    language: string
    overwriteContent: boolean
  }
}

export class ColocationModal extends Modal {
  result: ColocationSettings
  onSubmit: (result: ColocationSettings) => void
  lastTemplateValue: boolean
  settings: GinkoWebSettings
  existingFilePath?: string

  constructor(
    app: App,
    settings: GinkoWebSettings,
    lastTemplateValue: boolean,
    onSubmit: (result: ColocationSettings) => void,
    existingFilePath?: string,
  ) {
    super(app)
    this.settings = settings
    this.onSubmit = onSubmit
    this.lastTemplateValue = lastTemplateValue
    this.existingFilePath = existingFilePath
    this.result = {
      title: '',
      slugs: this.initializeSlugs(),
      useTemplate: lastTemplateValue,
    }
  }

  private initializeSlugs(): LanguageSlug[] {
    const slugs: LanguageSlug[] = []

    // Add main language
    if (this.settings.languages.mainLanguage) {
      slugs.push({
        code: this.settings.languages.mainLanguage,
        slug: '',
      })
    }

    // Add secondary languages
    if (this.settings.languages.secondaryLanguages) {
      this.settings.languages.secondaryLanguages.forEach((lang) => {
        slugs.push({
          code: lang,
          slug: '',
        })
      })
    }

    return slugs
  }

  onOpen() {
    const { contentEl } = this

    contentEl.createEl('h2', {
      text: this.existingFilePath
        ? 'Convert to Colocation Folder'
        : 'Create Colocation Folder',
    })

    new Setting(contentEl)
      .setName('Folder Title')
      .setDesc('Enter the title for your new folder')
      .addText(text => text
        .setPlaceholder('Enter title')
        .onChange((value) => {
          this.result.title = value
        }))

    if (this.existingFilePath) {
      // Add language selector for existing file
      new Setting(contentEl)
        .setName('Source File Language')
        .setDesc('Select which language this file represents')
        .addDropdown((dropdown) => {
          // Add all available languages
          const allLangs = [
            this.settings.languages.mainLanguage,
            ...this.settings.languages.secondaryLanguages,
          ]
          allLangs.forEach((lang) => {
            dropdown.addOption(lang, lang.toUpperCase())
          })

          dropdown.onChange((value) => {
            this.result.sourceFile = {
              path: this.existingFilePath!,
              language: value,
              overwriteContent: false,
            }

            // Pre-fill the slug for the selected language
            const fileName = this.existingFilePath!.split('/').pop()!
            const nameWithoutExt = fileName.replace(/\.md$/, '')
            const langSlug = this.result.slugs.find(s => s.code === value)
            if (langSlug) {
              langSlug.slug = nameWithoutExt
            }
          })

          // Set default to main language
          dropdown.setValue(this.settings.languages.mainLanguage)
          this.result.sourceFile = {
            path: this.existingFilePath!,
            language: this.settings.languages.mainLanguage,
            overwriteContent: false,
          }
        })

      // Add toggle for content overwrite
      new Setting(contentEl)
        .setName('Overwrite Content')
        .setDesc('If enabled, will overwrite the content with the template. If disabled, will keep the original content.')
        .addToggle(toggle => toggle
          .setValue(false)
          .onChange((value) => {
            if (this.result.sourceFile) {
              this.result.sourceFile.overwriteContent = value
            }
          }))
    }

    // Add separator for main language
    contentEl.createEl('h3', {
      text: 'Main Language',
      cls: 'colocation-modal-section-header',
    })

    // Add main language first
    const mainLang = this.result.slugs.find(slug => slug.code === this.settings.languages.mainLanguage)
    if (mainLang) {
      new Setting(contentEl)
        .setName(`${mainLang.code.toUpperCase()} Content`)
        .setDesc(`Enter the content name for ${mainLang.code} (main language)`)
        .addText(text => text
          .setPlaceholder(`e.g., my-content-${mainLang.code}`)
          .onChange((value) => {
            mainLang.slug = value
          }))
    }

    // Add separator for secondary languages
    const secondaryLangs = this.result.slugs.filter(slug => slug.code !== this.settings.languages.mainLanguage)
    if (secondaryLangs.length > 0) {
      contentEl.createEl('h3', {
        text: 'Secondary Languages',
        cls: 'colocation-modal-section-header',
      })

      // Add secondary languages
      secondaryLangs.forEach((langSlug) => {
        new Setting(contentEl)
          .setName(`${langSlug.code.toUpperCase()} Content`)
          .setDesc(`Enter the content name for ${langSlug.code}`)
          .addText(text => text
            .setPlaceholder(`e.g., my-content-${langSlug.code}`)
            .onChange((value) => {
              langSlug.slug = value
            }))
      })
    }

    new Setting(contentEl)
      .setName('Use Template')
      .setDesc('Use the template for this folder')
      .addToggle(toggle => toggle
        .setValue(this.lastTemplateValue)
        .onChange((value) => {
          this.result.useTemplate = value
        }))

    new Setting(contentEl)
      .addButton(btn =>
        btn
          .setButtonText(this.existingFilePath ? 'Convert' : 'Create')
          .setCta()
          .onClick(() => {
            this.close()
            this.onSubmit(this.result)
          }))
  }

  onClose() {
    const { contentEl } = this
    contentEl.empty()
  }
}
