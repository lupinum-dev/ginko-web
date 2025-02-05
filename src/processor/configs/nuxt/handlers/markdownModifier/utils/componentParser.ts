import type { ComponentChild, ComponentInfo } from '../types/ComponentInfo'

function parseProps(optionsStr: string): Record<string, string> {
  const props: Record<string, string> = {}
  if (!optionsStr)
    return props

  const optionsRegex = /(\w+)=["']([^"']*)["']|(\w+)/g
  let optionMatch: RegExpExecArray | null

  while ((optionMatch = optionsRegex.exec(optionsStr))) {
    const [, key, value, flagKey] = optionMatch
    if (key && value !== undefined) {
      // Convert camelCase to kebab-case
      const kebabKey = key.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
      props[kebabKey] = value
    }
    else if (flagKey) {
      // Handle boolean flags without values
      const kebabKey = flagKey.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
      props[kebabKey] = 'true'
    }
  }

  return props
}

export function getComponentInfo(content: string): ComponentInfo | null {
  // Match the main component declaration
  const mainMatch = content.match(/^::(\w+(?:-\w+)*)(?:\((.*?)\))?\s*(.*)(?:\n|$)/)
  if (!mainMatch)
    return null

  const [, component, optionsStr, mainContent] = mainMatch
  const props = parseProps(optionsStr || '')

  // Split content into lines to process children
  const lines = content.split('\n')
  const children: ComponentChild[] = []
  let currentPosition = 0
  let currentChild: ComponentChild | null = null
  let childContent: string[] = []
  let mainComponentContent: string[] = []
  let isCollectingMainContent = true

  // Process each line after the main component declaration
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]

    // Check for child component declaration
    if (line.trim().startsWith('--')) {
      isCollectingMainContent = false
      // If we have a current child, save it before starting a new one
      if (currentChild) {
        const content = childContent.join('\n')
        if (content)
          currentChild.content = content

        children.push(currentChild)
        childContent = []
      }

      const childMatch = line.trim().match(/^--(\w+)(?:\((.*?)\))?\s*(.*)$/)
      if (childMatch) {
        const [, childType, childOptionsStr, childMainContent] = childMatch
        currentPosition++

        currentChild = {
          type: childType,
          position: currentPosition,
          props: parseProps(childOptionsStr || ''),
        }

        // Only set main if it's provided
        if (childMainContent?.trim())
          currentChild.main = childMainContent.trim()
      }
    }
    // Check for end of main component
    else if (line.trim() === '::') {
      // Save the last child if exists
      if (currentChild) {
        const content = childContent.join('\n')
        if (content)
          currentChild.content = content

        children.push(currentChild)
      }
      break
    }
    // Add content to current child or main component
    else {
      if (isCollectingMainContent)
        mainComponentContent.push(line)
      else if (currentChild)
        childContent.push(line)
    }
  }

  const result: ComponentInfo = {
    component,
    props,
  }

  if (mainContent?.trim())
    result.main = mainContent.trim()

  const mainComponentContentStr = mainComponentContent.join('\n')
  if (mainComponentContentStr)
    result.content = mainComponentContentStr

  if (children.length > 0)
    result.children = children

  return result
}
