import type { FileHandler } from '../NuxtTaskProcessor'
import { FileSystemService } from '../../../services/FileSystemService'

export class OtherHandler implements FileHandler {
  private fileSystem: FileSystemService

  constructor() {
    this.fileSystem = new FileSystemService()
  }

  async handle(actionType: string, sourcePath: string, oldPath?: string): Promise<void> {

  }
}
