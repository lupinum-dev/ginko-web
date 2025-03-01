import { Notice } from 'obsidian'
import { v4 as uuidv4 } from 'uuid'

export function generateId(): string {
  return uuidv4().split('-')[0]
}

export function copyIdToClipboard(): void {
  const id = generateId()
  navigator.clipboard.writeText(id)
  new Notice(`ID copied: ${id}`)
}
