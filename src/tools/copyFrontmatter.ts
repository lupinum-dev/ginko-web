import type { Vault } from 'obsidian'
import { parseYaml, stringifyYaml, TFile } from 'obsidian'

let copiedFrontmatter: Record<string, any> | null = null

export function hasCopiedFrontmatter(): boolean {
  return copiedFrontmatter !== null
}

export async function copyFrontmatter(vault: Vault, filePath: string): Promise<void> {
  const file = vault.getAbstractFileByPath(filePath)
  if (!(file instanceof TFile)) {
    throw new TypeError('Not a file')
  }

  const content = await vault.read(file)
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/)

  if (!frontmatterMatch) {
    throw new Error('No frontmatter found in file')
  }

  const frontmatterContent = frontmatterMatch[1]
  copiedFrontmatter = parseYaml(frontmatterContent)
}

export async function pasteFrontmatter(vault: Vault, filePath: string, mode: 'override' | 'smart'): Promise<void> {
  if (!copiedFrontmatter) {
    throw new Error('No frontmatter copied')
  }

  const file = vault.getAbstractFileByPath(filePath)
  if (!(file instanceof TFile)) {
    throw new TypeError('Not a file')
  }

  const content = await vault.read(file)
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/)

  let newContent: string
  if (!frontmatterMatch) {
    // No existing frontmatter, add new one
    newContent = `---\n${stringifyYaml(copiedFrontmatter)}---\n\n${content}`
  }
  else {
    let newFrontmatter: Record<string, any>

    if (mode === 'override') {
      // Complete override
      newFrontmatter = { ...copiedFrontmatter }
    }
    else {
      // Smart merge
      const existingFrontmatter = parseYaml(frontmatterMatch[1])
      if (mode === 'smart') {
        // Add missing values from copied frontmatter, but don't overwrite existing ones
        newFrontmatter = {
          ...copiedFrontmatter,
          ...existingFrontmatter,
        }
      }
      else {
        throw new Error('Invalid paste mode')
      }
    }

    // Replace old frontmatter with new one
    newContent = content.replace(
      /^---\n[\s\S]*?\n---/,
      `---\n${stringifyYaml(newFrontmatter)}---`,
    )
  }

  await vault.modify(file, newContent)
}
