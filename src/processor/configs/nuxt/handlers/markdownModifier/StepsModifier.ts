import type { ContentModifier } from '../../markdownModifier'

/**
 * Converts steps sections into structured step components
 * Handles the ::steps syntax with --step markers
 */
export class StepsModifier implements ContentModifier {
  modify(content: string, frontmatter: Record<string, any> = {}): string {
    // Skip processing if content is inside a code block
    const codeBlockRegex = /```[\s\S]*?```/g
    const codeBlocks: string[] = []

    // Replace code blocks with placeholders
    const contentWithoutCodeBlocks = content.replace(codeBlockRegex, (match) => {
      const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`
      codeBlocks.push(match)
      return placeholder
    })

    // Process steps blocks - including the closing tag in our match
    let processedContent = contentWithoutCodeBlocks.replace(
      /::steps(?:\(([^)]*)\))?\s*([\s\S]*?)::(?:\s|$)/g,
      (match, attributes, stepsContent, offset, string) => {
        // Parse attributes for the steps container
        const containerAttrs = this.parseContainerAttributes(attributes || '')

        // Process individual steps
        const formattedSteps = this.processSteps(stepsContent)

        // Get any whitespace after the closing tag
        const afterMatch = string.substring(offset + match.length)
        const whitespaceAfter = afterMatch.match(/^(\s*)/)?.[1] || ''

        // Return the formatted steps block with proper closing tag and preserve whitespace
        return `::ginko-steps${containerAttrs}\n${formattedSteps}::${whitespaceAfter}`
      }
    )

    // Restore code blocks
    codeBlocks.forEach((block, index) => {
      processedContent = processedContent.replace(`__CODE_BLOCK_${index}__`, block)
    })

    return processedContent
  }

  private parseContainerAttributes(attributesStr: string): string {
    if (!attributesStr.trim()) {
      return '{level="h2"}'
    }

    // Parse the attributes
    const attributes = new Map<string, string>()
    const standaloneAttrs: string[] = []

    // Set default level if not specified
    if (!attributesStr.includes('level=')) {
      attributes.set('level', 'h2')
    }

    // Extract key="value" pairs
    const keyValueRegex = /(\w+)=["']([^"']*)["']/g
    let match

    while ((match = keyValueRegex.exec(attributesStr)) !== null) {
      const [, key, value] = match
      attributes.set(key, value)
    }

    // Extract standalone attributes
    const standaloneRegex = /\b(\w+)\b(?![=:"])/g
    let standaloneMatch
    const processedKeys = new Set<string>()

    // Create a temporary string with key-value pairs removed to find standalone attributes
    let tmpStr = attributesStr.replace(keyValueRegex, '')

    while ((standaloneMatch = standaloneRegex.exec(tmpStr)) !== null) {
      const [, key] = standaloneMatch
      // Skip keys that are already processed as key-value pairs
      if (!attributes.has(key) && !processedKeys.has(key)) {
        standaloneAttrs.push(key)
        processedKeys.add(key)
      }
    }

    // Format the attributes
    let result = ''

    // Add level first
    if (attributes.has('level')) {
      result += `level="${attributes.get('level')}"`
      attributes.delete('level')
    }

    // Add remaining key-value attributes
    for (const [key, value] of attributes.entries()) {
      if (result) result += ' '
      result += `${key}="${value}"`
    }

    // Add standalone attributes
    if (standaloneAttrs.length > 0) {
      if (result) result += ' '
      result += standaloneAttrs.join(' ')
    }

    return `{${result}}`
  }

  private processSteps(stepsContent: string): string {
    // Split content by --step markers
    // Using a workaround for the 's' flag by using [\s\S] instead
    const stepRegex = /--step(?:\(([^)]*)\))?\s*([\s\S]*?)(?=(?:--step|$))/g
    let formattedSteps = ''
    let match
    let stepNumber = 1

    while ((match = stepRegex.exec(stepsContent)) !== null) {
      const [, stepAttributes, stepContent] = match

      // Extract title and content
      const contentLines = stepContent.trim().split('\n')
      const title = contentLines[0].trim()

      // Get content lines after title, preserving empty lines but trimming the content as a whole
      let content = ''
      if (contentLines.length > 1) {
        content = contentLines.slice(1).join('\n').trim()
      }

      // Format the step with step number
      const attributesStr = this.formatStepAttributes(stepAttributes || '', title, stepNumber)
      formattedSteps += `::ginko-step${attributesStr} \n${content}\n::\n`

      // Increment step number for the next step
      stepNumber++
    }

    return formattedSteps
  }

  private formatStepAttributes(attributesStr: string, title: string, stepNumber: number): string {
    // Start with the title attribute
    const attributes = new Map<string, string>([
      ['title', title],
      ['step', stepNumber.toString()] // Add step number
    ])
    const standaloneAttrs: string[] = []

    if (!attributesStr.trim()) {
      return `{title="${title}" step="${stepNumber}"}`
    }

    // Extract key="value" pairs
    const keyValueRegex = /(\w+)=["']([^"']*)["']/g
    let match

    while ((match = keyValueRegex.exec(attributesStr)) !== null) {
      const [, key, value] = match
      attributes.set(key, value)
    }

    // Extract standalone attributes
    // Create a temporary string with key-value pairs removed to find standalone attributes
    let tmpStr = attributesStr.replace(keyValueRegex, '')
    const standaloneRegex = /\b(\w+)\b(?![=:"])/g
    let standaloneMatch
    const processedKeys = new Set<string>()

    while ((standaloneMatch = standaloneRegex.exec(tmpStr)) !== null) {
      const [, key] = standaloneMatch
      // Skip keys that are already processed as key-value pairs
      if (!attributes.has(key) && !processedKeys.has(key)) {
        standaloneAttrs.push(key)
        processedKeys.add(key)
      }
    }

    // Format the attributes with title first, then step
    let result = `title="${attributes.get('title')}" step="${attributes.get('step')}"`
    attributes.delete('title')
    attributes.delete('step')

    // Add icon if present
    if (attributes.has('icon')) {
      result += ` icon="${attributes.get('icon')}"`
      attributes.delete('icon')
    }

    // Add remaining key-value attributes
    for (const [key, value] of attributes.entries()) {
      result += ` ${key}="${value}"`
    }

    // Add standalone attributes
    if (standaloneAttrs.length > 0) {
      result += ` ${standaloneAttrs.join(' ')}`
    }

    return `{${result}}`
  }
}