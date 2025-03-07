import { Notice, TFile, TFolder, Vault } from 'obsidian'
import { join } from 'path'
import * as fs from 'fs'

// Hardcoded paths as requested
const sourceFolder = '/Users/matthias/Git/2025/ginko-web/demo'
const targetFolder = '/Users/matthias/Git/2025/ginko-web/target'
const outputJsonPath = '/Users/matthias/Git/2025/ginko-web/folder-structure.json'

// Files to ignore
const ignoredFiles = ['package.json', '.DS_Store']

// Folders to ignore
const ignoredFolders = ['.obsidian']

interface FileNode {
  name: string
  type: 'file' | 'folder'
  path: string
  children?: FileNode[]
  content?: string
  extension?: string
}

/**
 * Recursively builds a file tree structure
 * @param folderPath The folder path to process
 * @returns A promise resolving to the file tree structure
 */
async function buildFileTree(folderPath: string): Promise<FileNode> {
  const folderName = folderPath.split('/').pop() || ''
  
  const node: FileNode = {
    name: folderName,
    type: 'folder',
    path: folderPath,
    children: []
  }

  try {
    const items = fs.readdirSync(folderPath, { withFileTypes: true })
    
    for (const item of items) {
      // Skip ignored files
      if (ignoredFiles.includes(item.name)) {
        continue
      }
      
      // Skip ignored folders
      if (item.isDirectory() && ignoredFolders.includes(item.name)) {
        continue
      }
      
      const itemPath = join(folderPath, item.name)
      
      if (item.isDirectory()) {
        const childNode = await buildFileTree(itemPath)
        node.children!.push(childNode)
      } else {
        const extension = item.name.split('.').pop() || ''
        const fileNode: FileNode = {
          name: item.name,
          type: 'file',
          path: itemPath,
          extension: extension
        }
        
        // Include content for markdown files
        if (extension === 'md') {
          try {
            const content = fs.readFileSync(itemPath, 'utf8')
            fileNode.content = content
          } catch (error) {
            console.error(`Error reading file ${itemPath}:`, error)
          }
        }
        
        node.children!.push(fileNode)
      }
    }
  } catch (error) {
    console.error(`Error processing folder ${folderPath}:`, error)
  }

  return node
}

/**
 * Exports the folder structure to a JSON file
 */
export async function exportFolderStructure(): Promise<void> {
  try {
    // Ensure target folder exists
    if (!fs.existsSync(targetFolder)) {
      fs.mkdirSync(targetFolder, { recursive: true })
    }
    
    // Build the file tree for source folder
    const sourceTree = await buildFileTree(sourceFolder)
    
    // Build the file tree for target folder (if it exists)
    let targetTree = null
    if (fs.existsSync(targetFolder)) {
      targetTree = await buildFileTree(targetFolder)
    }
    
    // Create the output object with source and target properties
    const outputObject = {
      source: sourceTree,
      target: targetTree || {}
    }
    
    // Convert to JSON
    const jsonContent = JSON.stringify(outputObject, null, 2)
    
    // Write to file
    fs.writeFileSync(outputJsonPath, jsonContent)
    
    new Notice(`✅ Folder structure exported to ${outputJsonPath}`)
    console.log(`Folder structure exported to ${outputJsonPath}`)
    
    return
  } catch (error) {
    console.error('Error exporting folder structure:', error)
    new Notice(`❌ Failed to export folder structure: ${error.message}`)
    throw error
  }
}