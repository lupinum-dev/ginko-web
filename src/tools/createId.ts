import { Notice } from 'obsidian'
import { v4 as uuidv4 } from 'uuid'

export function generateId(): string {
  const fullId = uuidv4().replace(/-/g, '')
  for (let i = 0; i <= fullId.length - 8; i++) {
    const segment = fullId.slice(i, i + 8)
    if (/^[a-zA-Z]/.test(segment)) {
      return segment
    }
  }
  // In the extremely unlikely case no segment starts with a letter, generate a new UUID
  return generateId()
}

export function copyIdToClipboard(): void {
  const id = generateId()
  navigator.clipboard.writeText(id)
  new Notice(`ID copied: ${id}`)
}
