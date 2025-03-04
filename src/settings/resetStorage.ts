import type { App } from 'obsidian'
import { Modal, Notice, Setting } from 'obsidian'

/**
 * Interface representing a local storage item
 */
interface StorageItem {
  key: string
  value: string
}

/**
 * Modal dialog for managing Ginko Web local storage items
 */
export class ResetStorageModal extends Modal {
  private storageItems: StorageItem[] = []
  private storagePrefix = 'ginko-web'

  constructor(app: App) {
    super(app)
    this.loadStorageItems()
  }

  /**
   * Load all Ginko Web related storage items
   */
  private loadStorageItems(): void {
    this.storageItems = []

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)

      if (key && this.isGinkoStorageItem(key)) {
        const value = localStorage.getItem(key) || ''
        this.storageItems.push({ key, value })
      }
    }
  }

  /**
   * Check if a key belongs to Ginko Web storage
   */
  private isGinkoStorageItem(key: string): boolean {
    return key.startsWith(this.storagePrefix)
  }

  onOpen() {
    const { contentEl } = this
    contentEl.empty()
    contentEl.addClass('ginko-web-reset-storage-modal')

    contentEl.createEl('h2', { text: 'Reset Local Storage' })

    if (this.storageItems.length === 0) {
      this.handleNoItemsFound()
      return
    }

    this.renderStorageItems(contentEl)
    this.addDeleteAllButton(contentEl)
  }

  /**
   * Handle the case when no storage items are found
   */
  private handleNoItemsFound(): void {
    new Notice('No Ginko web storage items found')
    this.close()
  }

  /**
   * Render the list of storage items
   */
  private renderStorageItems(container: HTMLElement): void {
    const storageList = container.createDiv('storage-list')

    this.storageItems.forEach((item) => {
      this.createStorageItemSetting(storageList, item)
    })
  }

  /**
   * Create a setting for an individual storage item
   */
  private createStorageItemSetting(container: HTMLElement, item: StorageItem): Setting {
    return new Setting(container)
      .setName(item.key)
      .setDesc(`Value: ${item.value}`)
      .addButton(button => button
        .setButtonText('Delete')
        .onClick(() => {
          this.deleteStorageItem(item.key, button.settingEl)
        })
      )
  }

  /**
   * Delete a single storage item
   */
  private deleteStorageItem(key: string, settingEl: HTMLElement): void {
    localStorage.removeItem(key)
    settingEl.remove()
    new Notice(`Deleted ${key}`)

    // Refresh the list
    this.loadStorageItems()

    if (this.storageItems.length === 0) {
      this.close()
    }
  }

  /**
   * Add a delete all button to the modal
   */
  private addDeleteAllButton(container: HTMLElement): void {
    new Setting(container)
      .addButton(button => button
        .setButtonText('Delete All')
        .setWarning()
        .onClick(() => {
          this.deleteAllStorageItems()
        })
      )
  }

  /**
   * Delete all Ginko Web storage items
   */
  private deleteAllStorageItems(): void {
    this.storageItems.forEach((item) => {
      localStorage.removeItem(item.key)
    })

    new Notice('All Ginko web storage items deleted')
    this.close()
  }

  onClose() {
    const { contentEl } = this
    contentEl.empty()
  }
}