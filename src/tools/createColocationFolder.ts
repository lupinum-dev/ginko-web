import type { Vault } from 'obsidian'
import { TFile, TFolder } from 'obsidian'
import { v4 as uuidv4 } from 'uuid'

export async function createColocationFolder(vault: Vault, filePath: string): Promise<string> {
  const file = vault.getAbstractFileByPath(filePath)
  if (!(file instanceof TFile)) {
    throw new TypeError('Not a file')
  }

  const parent = file.parent
  const fileName = file.name
  const fileNameWithoutExtension = fileName.split('.').slice(0, -1).join('.')
  const newFolderName = `${fileNameWithoutExtension}+`
  const newFolderPath = `${parent ? `${parent.path}/` : ''}${newFolderName}`

  try {
    // Create the new folder
    await vault.createFolder(newFolderPath)

    // Move the file to the new folder
    const newFilePath = `${newFolderPath}/${fileName}`
    await vault.rename(file, newFilePath)

    return newFolderPath
  }
  catch (error) {
    console.error('Error creating colocation folder:', error)
    throw error
  }
}

export async function addUidToFileOrFolder(vault: Vault, path: string): Promise<string> {
  const item = vault.getAbstractFileByPath(path)
  if (!(item instanceof TFile || item instanceof TFolder)) {
    throw new TypeError('Not a file or folder')
  }

  const name = item.name
  const uid = uuidv4().split('-')[0]
  let newName: string

  // Regular expression to match existing UID pattern
  const uidPattern = /\s*-\s*[a-f0-9]{8}\s*$/
  const hasExistingUid = uidPattern.test(name)

  if (hasExistingUid) {
    // If UID already exists, just fix spacing if needed
    newName = name.replace(uidPattern, (match) => {
      const trimmedMatch = match.trim()
      return ` - ${trimmedMatch.slice(2)}`
    })
  }
  else {
    // Remove trailing '+' if it exists
    const baseName = name.endsWith('+') ? name.slice(0, -1) : name

    if (item instanceof TFile) {
      const fileExtension = baseName.split('.').pop()
      const nameWithoutExtension = baseName.split('.').slice(0, -1).join('.')
      newName = `${nameWithoutExtension} - ${uid}.${fileExtension}`
    }
    else {
      newName = `${baseName} - ${uid}`
    }

    // Add '+' if it's a folder or if it was present originally
    if (item instanceof TFolder || name.endsWith('+')) {
      newName += '+'
    }
  }

  if (newName === name) {
    // No changes needed
    return path
  }

  const newPath = `${item.parent?.path ?? ''}/${newName}`

  try {
    await vault.rename(item, newPath)
    return newPath
  }
  catch (error) {
    console.error('Error adding UID to file or folder:', error)
    throw error
  }
}
