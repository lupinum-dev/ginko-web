import type { Buffer } from 'node:buffer'
import type { GinkoWebSettings } from '../../settings/settingsTypes'
import * as crypto from 'node:crypto'
import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import { parseYAML } from 'confbox'
import { useGinkoSettings } from '../../composables/useGinkoSettings'

export class FileSystemService {
  async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath)
      return true
    }
    catch {
      return false
    }
  }

  private getSettings(): GinkoWebSettings {
    return useGinkoSettings()
  }

  async readFile(filePath: string): Promise<Buffer> {
    try {
      return await fs.readFile(filePath)
    }
    catch (error) {
      throw this.wrapError('read', filePath, undefined, error)
    }
  }

  async copyFile(sourcePath: string, targetPath: string): Promise<void> {
    try {
      if (!await this.exists(sourcePath)) {
        throw new Error(`Source file does not exist: ${sourcePath}`)
      }
      await this.ensureDir(path.dirname(targetPath))
      await fs.copyFile(sourcePath, targetPath)
    }
    catch (error) {
      throw this.wrapError('copy', sourcePath, targetPath, error)
    }
  }

  // SYMLINK VERSION
  // async copyFile(sourcePath: string, targetPath: string): Promise<void> {
  //   try {
  //     if (!await this.exists(sourcePath)) {
  //       throw new Error(`Source file does not exist: ${sourcePath}`)
  //     }
  //     await this.ensureDir(path.dirname(targetPath))
  //     await fs.symlink(sourcePath, targetPath)
  //   } catch (error) {
  //     if (error.code === 'EEXIST') {
  //       return
  //     }
  //     throw this.wrapError('link', sourcePath, targetPath, error)
  //   }
  // }

  async deleteFile(filePath: string): Promise<void> {
    try {
      if (await this.exists(filePath)) {
        await fs.unlink(filePath)
      }
    }
    catch (error) {
      throw this.wrapError('delete', filePath, undefined, error)
    }
  }

  async writeFile(filePath: string, data: string | Buffer): Promise<void> {
    try {
      await this.ensureDir(path.dirname(filePath))
      await fs.writeFile(filePath, data)
    }
    catch (error) {
      throw this.wrapError('write', filePath, undefined, error)
    }
  }

  async remove(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath)
    }
    catch (error) {
      throw this.wrapError('remove', filePath, undefined, error)
    }
  }

  async ensureDir(dirPath: string): Promise<void> {
    try {
      if (dirPath === '/' || dirPath === '\\.cache') {
        throw new Error(`Invalid directory path: ${dirPath}. Must be a relative or project path.`)
      }
      await fs.mkdir(dirPath, { recursive: true })
    }
    catch (error) {
      throw this.wrapError('ensureDir', dirPath, undefined, error)
    }
  }

  async resetOutputDirectory(): Promise<void> {
    const settings = this.getSettings()
    if (!settings.paths.websitePath) {
      throw new Error('Website path is not configured')
    }
    const dirPath = settings.paths.websitePath

    try {
      // Define paths to clean
      const pathsToDelete = [
        path.join(dirPath, 'content'),
        path.join(dirPath, 'public', '_assets'),
      ]

      // Delete only specific directories
      for (const pathToDelete of pathsToDelete) {
        if (await this.exists(pathToDelete)) {
          await fs.rm(pathToDelete, { recursive: true, force: true })
          // Recreate the empty directory
          await fs.mkdir(pathToDelete, { recursive: true })
        }
      }
    }
    catch (error) {
      console.error('Error resetting output directories:', error)
      throw new Error(`Failed to reset output directories: ${error.message}`)
    }
  }

  private async generateFileUid(sourcePath: string): Promise<string> {
    const settings = this.getSettings()

    if (!settings.paths.vaultPath) {
      throw new Error('Vault path is not configured')
    }

    const fullPath = path.join(settings.paths.vaultPath, sourcePath)
    const content = await this.readFile(fullPath)
    return crypto.createHash('md5').update(content).digest('hex')
  }

  public async getAssetOutputPath(sourcePath: string): Promise<{ outputRelativePath: string, uid: string }> {
    const ext = path.extname(sourcePath)
    const uid = await this.generateFileUid(sourcePath)
    return {
      outputRelativePath: path.join('public', '_assets', `${uid}${ext}`),
      uid,
    }
  }

  async getFrontmatterContent(filePath: string): Promise<{
    data: Record<string, any>
    content: string
  }> {
    try {
      const fileContent = await this.readFile(filePath)
      const contentStr = fileContent.toString()
      const yamlMatch = contentStr.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)

      if (!yamlMatch) {
        return {
          data: {},
          content: contentStr,
        }
      }

      const [, yamlContent, markdownContent] = yamlMatch
      const data = parseYAML(yamlContent)

      return {
        data: data as Record<string, any>,
        content: markdownContent.trim(),
      }
    }
    catch (error) {
      console.error('Error getting frontmatter content:', error)
      throw this.wrapError('read frontmatter', filePath, undefined, error)
    }
  }

  async readdir(dirPath: string): Promise<string[]> {
    try {
      return await fs.readdir(dirPath)
    }
    catch (error) {
      throw this.wrapError('read directory', dirPath, undefined, error)
    }
  }

  private wrapError(operation: string, sourcePath: string, targetPath: string | undefined, error: unknown): Error {
    const message = targetPath
      ? `Failed to ${operation} from ${sourcePath} to ${targetPath}`
      : `Failed to ${operation} ${sourcePath}`
    return error instanceof Error ? error : new Error(`${message}: ${error}`)
  }
}
