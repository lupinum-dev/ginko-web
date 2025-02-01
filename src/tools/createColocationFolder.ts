import type { Vault } from 'obsidian'
import { TFile, TFolder } from 'obsidian'
import { v4 as uuidv4 } from 'uuid'

interface LanguageSlug {
  code: string
  slug: string
}

export interface ColocationFolderOptions {
  title: string
  slugs: LanguageSlug[]
  useTemplate: boolean
}

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD') // Normalize to decomposed form for handling accents
    .replace(/[\u0300-\u036F]/g, '') // Remove diacritics
    .replace(/[^a-z0-9\-]/g, '-') // Replace non-alphanumeric with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
}

export async function createColocationFolder(
  vault: Vault,
  parentPath: string,
  options: ColocationFolderOptions,
): Promise<string> {
  console.log('Creating colocation folder with:', {
    parentPath,
    options,
  })

  const parent = vault.getAbstractFileByPath(parentPath)
  if (!(parent instanceof TFolder)) {
    throw new TypeError('Parent must be a folder')
  }

  // Generate UID and create folder name
  const uid = uuidv4().split('-')[0]
  // Keep original title, just ensure the UID part is consistent
  const newFolderName = `${options.title} - ${uid}+`
  const newFolderPath = `${parent.path}/${newFolderName}`

  console.log('Folder structure to create:', {
    parentFolder: parent.path,
    newFolderName,
    newFolderPath,
    languageSlugs: options.slugs,
  })

  try {
    // Create the main folder
    await vault.createFolder(newFolderPath)

    // Create language-specific markdown files
    for (const langSlug of options.slugs) {
      if (langSlug.slug) {
        const slugifiedName = slugify(langSlug.slug)
        const mdFileName = `${slugifiedName}__${langSlug.code}.md`
        await vault.create(
          `${newFolderPath}/${mdFileName}`,
          `# ${options.title}\n\n`, // Initial content with title
        )
      }
    }

    // TODO: Handle template creation if options.useTemplate is true
    // This would be implemented based on your template system

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
