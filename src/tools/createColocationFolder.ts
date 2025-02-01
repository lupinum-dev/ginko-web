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
  sourceFile?: {
    path: string
    language: string
    overwriteContent: boolean
  }
}

function extractFrontmatter(content: string): { frontmatter: string | null, body: string } {
  const fmRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/
  const match = content.match(fmRegex)

  if (match) {
    return {
      frontmatter: match[1],
      body: match[2].trim(),
    }
  }

  return {
    frontmatter: null,
    body: content.trim(),
  }
}

function mergeFrontmatterAndContent(templateContent: string, sourceContent: string): string {
  const template = extractFrontmatter(templateContent)
  const source = extractFrontmatter(sourceContent)

  // If template has no frontmatter, return source content
  if (!template.frontmatter) {
    return sourceContent
  }

  // If source has no frontmatter, add template's frontmatter
  if (!source.frontmatter) {
    return `---\n${template.frontmatter}\n---\n\n${source.body}`
  }

  // Merge frontmatter (template takes precedence for duplicate keys)
  const sourceFM = Object.fromEntries(
    source.frontmatter.split('\n')
      .map(line => line.split(':').map(part => part.trim()))
      .filter(parts => parts.length === 2),
  )

  const templateFM = Object.fromEntries(
    template.frontmatter.split('\n')
      .map(line => line.split(':').map(part => part.trim()))
      .filter(parts => parts.length === 2),
  )

  const mergedFM = { ...sourceFM, ...templateFM }
  const mergedFMString = Object.entries(mergedFM)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n')

  return `---\n${mergedFMString}\n---\n\n${source.body}`
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

async function findNearestTemplate(vault: Vault, startPath: string): Promise<TFile | null> {
  // Split the path into segments
  const pathSegments = startPath.split('/')

  // Try each path from most specific to least specific
  while (pathSegments.length > 0) {
    const currentPath = pathSegments.join('/')
    const templatePath = `${currentPath}/_template.md`

    console.log('Checking for template at:', templatePath)

    const templateFile = vault.getAbstractFileByPath(templatePath)
    if (templateFile instanceof TFile) {
      console.log('Found template at:', templatePath)
      return templateFile
    }

    // Remove the last segment and try again
    pathSegments.pop()
  }

  // Check root level
  const rootTemplate = vault.getAbstractFileByPath('_template.md')
  if (rootTemplate instanceof TFile) {
    console.log('Found template at root: _template.md')
    return rootTemplate
  }

  return null
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

    // Find template if enabled
    let templateContent = `# ${options.title}\n\n`
    if (options.useTemplate) {
      const template = await findNearestTemplate(vault, parentPath)
      if (template) {
        templateContent = await vault.read(template)
        // Replace any title in the template with our new title
        templateContent = templateContent.replace(/^# .+$/m, `# ${options.title}`)
      }
    }

    // If we're converting a file, read its content
    let sourceContent: string | null = null
    if (options.sourceFile?.path) {
      const sourceFile = vault.getAbstractFileByPath(options.sourceFile.path)
      if (sourceFile instanceof TFile) {
        sourceContent = await vault.read(sourceFile)
      }
    }

    // Create language-specific markdown files
    for (const langSlug of options.slugs) {
      if (langSlug.slug) {
        const slugifiedName = slugify(langSlug.slug)
        const mdFileName = `${slugifiedName}__${langSlug.code}.md`

        // Determine content for this file
        let fileContent = templateContent
        if (sourceContent && options.sourceFile?.language === langSlug.code) {
          if (options.sourceFile.overwriteContent) {
            fileContent = templateContent
          }
          else {
            // Merge template frontmatter with source content
            fileContent = mergeFrontmatterAndContent(templateContent, sourceContent)
          }
        }

        await vault.create(
          `${newFolderPath}/${mdFileName}`,
          fileContent,
        )
      }
    }

    // If this was a conversion, delete the original file
    if (options.sourceFile?.path) {
      const sourceFile = vault.getAbstractFileByPath(options.sourceFile.path)
      if (sourceFile instanceof TFile) {
        await vault.delete(sourceFile)
      }
    }

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
