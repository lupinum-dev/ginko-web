import { App, Modal, Setting } from 'obsidian';

/**
 * A modal that asks for confirmation before performing an action
 */
export class ConfirmationModal extends Modal {
  private confirmCallback: () => void;
  private title: string;
  private message: string;
  private confirmButtonText: string;

  constructor(
    app: App,
    title: string,
    message: string,
    confirmButtonText: string,
    confirmCallback: () => void
  ) {
    super(app);
    this.title = title;
    this.message = message;
    this.confirmButtonText = confirmButtonText;
    this.confirmCallback = confirmCallback;
  }

  onOpen() {
    const { contentEl } = this;

    contentEl.createEl('h2', { text: this.title });
    contentEl.createEl('p', { text: this.message });

    new Setting(contentEl)
      .addButton((btn) =>
        btn
          .setButtonText('Cancel')
          .setCta()
          .onClick(() => {
            this.close();
          })
      )
      .addButton((btn) =>
        btn
          .setButtonText(this.confirmButtonText)
          .setWarning()
          .setCta()
          .onClick(() => {
            this.confirmCallback();
            this.close();
          })
      );
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
} 