import type { App } from 'obsidian'
import type GinkoWebPlugin from '../main'
import { Modal } from 'obsidian'
import { WEBSITE_TEMPLATES } from './settingsConstants'

export class TemplatesModal extends Modal {
  plugin: GinkoWebPlugin
  onChoose: (templateId: string) => void

  constructor(app: App, plugin: GinkoWebPlugin, onChoose: (templateId: string) => void) {
    super(app)
    this.plugin = plugin
    this.onChoose = onChoose
  }

  onOpen() {
    const { contentEl } = this

    // Modal Header
    const header = contentEl.createDiv('ginko-web-templates-header')
    header.createEl('h2', { text: 'Available Templates' })
    header.createEl('p', {
      text: 'Choose a template that best fits your needs. Each template comes with pre-configured settings and optimized layouts.',
    })

    // Templates Grid
    const grid = contentEl.createDiv('ginko-web-templates-grid')

    WEBSITE_TEMPLATES.forEach((template) => {
      const card = grid.createDiv('ginko-web-template-card')

      // Preview Image
      const preview = card.createDiv('ginko-web-template-preview')
      preview.createEl('img', {
        attr: {
          src: `https://ginko.build/templates/${template.id}.png`,
          alt: `${template.name} preview`,
        },
      })

      // Template Info
      const info = card.createDiv('ginko-web-template-info')

      // Header with icon and name
      const header = info.createDiv('ginko-web-template-header')
      const iconContainer = header.createDiv('ginko-web-template-icon')
      iconContainer.innerHTML = template.icon
      header.createEl('h3', { text: template.name })

      // Description
      info.createEl('p', {
        text: template.description,
        cls: 'ginko-web-template-description',
      })

      // Features list (you can add this to your WEBSITE_TEMPLATES data)
      const features = info.createDiv('ginko-web-template-features')
      features.createEl('h4', { text: 'Key Features' })
      const featuresList = features.createEl('ul')
        ;[
          'SEO Optimized',
          'Mobile Responsive',
          'Dark/Light Mode',
          'Search Functionality',
        ].forEach((feature) => {
          featuresList.createEl('li', { text: feature })
        })

      // Action buttons
      const actions = card.createDiv('ginko-web-template-actions')

      // Preview button
      const previewBtn = actions.createEl('a', {
        text: '🔍 Live Preview',
        cls: 'ginko-web-template-button mod-preview',
        href: `https://ginko.build/templates/${template.id}`,
        attr: { target: '_blank' },
      })

      // Choose button
      const chooseBtn = actions.createEl('button', {
        text: '✨ Use Template',
        cls: 'ginko-web-template-button mod-choose',
      })

      chooseBtn.addEventListener('click', () => {
        this.onChoose(template.id)
        this.close()
      })
    })
  }

  onClose() {
    const { contentEl } = this
    contentEl.empty()
  }
}
