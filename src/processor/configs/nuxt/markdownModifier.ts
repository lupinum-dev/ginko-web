import { basename, extname } from 'node:path'
import { parseYAML } from 'confbox'
import { CacheService } from '../../services/CacheService'

const generateRandomId = () => Math.random().toString(36).substring(2, 10)

export class LinkModifier implements ContentModifier {
  private extractUID(segment: string): string | null {
    const decodedSegment = decodeURIComponent(segment)
    const match = decodedSegment.match(/ - ([a-f0-9]{8})\+$/)
    return match ? match[1] : null
  }

  private parseProperties(linkText: string): { cleanTitle: string, properties: Record<string, string | boolean> } {
    let cleanTitle = linkText.trim()
    const properties: Record<string, string | boolean> = {}

    // Match all hashtag properties
    const hashtagPattern = /#([^=\s]+)(?:=["']([^"']+)["']|\s|$)/g
    let match

    while ((match = hashtagPattern.exec(linkText)) !== null) {
      const [fullMatch, key, value] = match
      // Remove the matched hashtag from cleanTitle
      cleanTitle = cleanTitle.replace(fullMatch, '').trim()

      // If there's a value, store it as string, otherwise store as boolean true
      properties[key] = value !== undefined ? value : true
    }

    return { cleanTitle, properties }
  }

  modify(content: string, frontmatter: Record<string, any>): string {
    return content.replace(
      /(?<!!)\[([^\]]+)\]\(([^)]+)\)/g,
      (match, linkText, linkPath) => {
        if (linkPath.startsWith('http')) {
          return match
        }

        const pathParts = linkPath.split('/')
        const contentType = pathParts[0]
        let uid: string | null = null

        for (const part of pathParts) {
          uid = this.extractUID(part)
          if (uid) {
            break
          }
        }

        // Parse properties from link text
        const { cleanTitle, properties } = this.parseProperties(linkText)

        // Build the ginko-link component
        let ginkoLink = `:ginko-link{src="/${contentType}/${uid}" title="${cleanTitle}"`

        // Add all properties to the component
        for (const [key, value] of Object.entries(properties)) {
          if (typeof value === 'string') {
            ginkoLink += ` ${key}="${value}"`
          }
          else {
            ginkoLink += ` ${key}`
          }
        }

        ginkoLink += '}'
        return ginkoLink
      },
    )
  }
}

export class AssetLinkModifier implements ContentModifier {
  private readonly imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.avif']
  private readonly videoExtensions = ['.mp4', '.webm']
  private readonly audioExtensions = ['.mp3', '.wav', '.ogg']

  private normalizePath(path: string): string[] {
    return path.split('/').filter(Boolean).map(decodeURIComponent)
  }

  private extractUID(segment: string): string | null {
    const match = segment.match(/ - ([a-f0-9]{8})\+$/)
    return match ? match[1] : null
  }

  private cleanFilename(filename: string): string {
    return filename.replace(/ /g, '-')
  }

  private isImageFile(filename: string): boolean {
    const ext = extname(filename).toLowerCase()
    return this.imageExtensions.includes(ext)
  }

  private isVideoFile(filename: string): boolean {
    const ext = extname(filename).toLowerCase()
    return this.videoExtensions.includes(ext)
  }

  private isAudioFile(filename: string): boolean {
    const ext = extname(filename).toLowerCase()
    return this.audioExtensions.includes(ext)
  }

  private processAssetPath(assetPath: string): { targetPath: string, size?: { width: number, height: number } } {
    // First decode the entire path and normalize backslashes to forward slashes
    const decodedPath = decodeURIComponent(assetPath).replace(/\\/g, '/')

    // Split the path into parts and filter out empty segments
    const parts = decodedPath
      .split('/')
      .filter(Boolean)
      .map(part => part.trim())

    // Join the parts back together with forward slashes to create normalized path
    const normalizedPath = parts.join('/')

    // Get cache instance
    const cacheService = new CacheService()

    // Find matching asset in cache
    const cacheItem = cacheService.getCacheItemBySourcePath(normalizedPath)

    if (!cacheItem) {
      console.info(`Asset not found in cache for path: ${normalizedPath}. Ensure the asset file name contains only alphanumeric characters (a-z, A-Z, 0-9).`)
      return { targetPath: assetPath } // Return original path if not found
    }

    // Remove 'public/' prefix and normalize any backslashes in targetPath
    const targetPath = cacheItem.targetPath
      .replace(/^public[\\/]/, '') // Remove public/ or public\ prefix
      .replace(/\\/g, '/') // Normalize backslashes to forward slashes

    return {
      targetPath: `/${targetPath}`, // Ensure leading slash
      size: cacheItem.size,
    }
  }

  private parseAltText(altText: string): { cleanAltText: string, properties: Record<string, string | boolean> } {
    let cleanAltText = altText.trim()
    const properties: Record<string, string | boolean> = {}

    // Match all hashtag properties
    const hashtagPattern = /#([^=\s]+)(?:=["']([^"']+)["']|\s|$)/g
    let match

    while ((match = hashtagPattern.exec(altText)) !== null) {
      const [fullMatch, key, value] = match
      // Remove the matched hashtag from cleanAltText
      cleanAltText = cleanAltText.replace(fullMatch, '').trim()

      // If there's a value, store it as a string, otherwise store as boolean true
      properties[key] = value !== undefined ? value : true
    }

    return { cleanAltText, properties }
  }

  modify(content: string, frontmatter: Record<string, any>): string {
    let heroImage: string | null = null
    const updatedFrontmatter = { ...frontmatter }

    const modifiedContent = content.replace(
      /!\[(.*?)\]\((.*?)\)/g,
      (match, altText, assetPath) => {
        if (assetPath.startsWith('http')) {
          return match
        }

        try {
          const { targetPath, size } = this.processAssetPath(assetPath)
          const fileName = basename(targetPath)
          const isImage = this.isImageFile(fileName)
          const isVideo = this.isVideoFile(fileName)
          const isAudio = this.isAudioFile(fileName)
          // Parse alt text and properties
          const { cleanAltText, properties } = this.parseAltText(altText)

          if (properties.hero) {
            heroImage = targetPath
            updatedFrontmatter.hero_image = targetPath
          }

          console.log('targetPath', targetPath)

          if (isImage) {
            // Build the custom-image component with all properties
            // let imageComponent = `:ginko-image{src="${targetPath}" alt="${cleanAltText}"`
            let imageComponent = `![](${targetPath})`

            // Add size properties if available
            // if (size) {
            //   imageComponent += ` width="${size.width}" height="${size.height}"`
            // }

            // Add all other properties to the component
            for (const [key, value] of Object.entries(properties)) {
              if (typeof value === 'string') {
                imageComponent += ` ${key}="${value}"`
              }
              else {
                imageComponent += ` ${key}`
              }
            }

            imageComponent += '}'
            return imageComponent
          }
          else if (isVideo) {
            const labelProp = cleanAltText ? ` label="${cleanAltText}"` : ''
            return `:ginko-video{src="${targetPath}"${labelProp}}\n`
          }
          else if (isAudio) {
            const labelProp = cleanAltText ? ` label="${cleanAltText}"` : ''
            return `:ginko-audio{src="${targetPath}"${labelProp}}\n`
          }
          else {
            // For downloads, use original filename if no alt text
            let label = cleanAltText
            if (!label) {
              // Extract original filename from the asset path
              const pathParts = assetPath.split('/')
              const lastPart = pathParts[pathParts.length - 1]
              label = decodeURIComponent(lastPart)
            }
            const labelProp = label ? ` label="${label}"` : ''
            return `:ginko-download{src="${targetPath}"${labelProp}}\n`
          }
        }
        catch (error) {
          console.error(`Error processing asset link: ${assetPath}`, error)
          return match
        }
      },
    )

    // Return both the modified content and updated frontmatter
    return `---\n${Object.entries(updatedFrontmatter)
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
      .join('\n')}\n---\n${modifiedContent}`
  }
}

/**
 * Interface for content modifiers that can transform markdown content
 */
export interface ContentModifier {
  modify: (content: string, frontmatter: Record<string, any>) => string

  // add the
}

/**
 * Parses FAQ sections in markdown and extracts content
 * Example:
 * Input:  ::faq
 *         - **Question 1**
 *         	- Answer 1
 *         ::
 */
export class FaqModifier implements ContentModifier {
  private cleanMarkdownFormatting(text: string): string {
    return text
      .replace(/[*#]+/g, '')
      .replace(/^#+\s*/, '')
      .trim()
  }

  private parseFaqContent(content: string): Array<{ id: string, question: string, answer: string }> {
    const faqs: Array<{ id: string, question: string, answer: string }> = []

    const lines = content.split('\n')
      .map(line => line)
      .filter(line => line.trim())

    for (let i = 0; i < lines.length; i++) {
      const currentLine = lines[i]
      const nextLine = lines[i + 1]

      const currentIndent = (currentLine.match(/^\s*/)?.[0] || '').length
      const nextIndent = nextLine ? (nextLine.match(/^\s*/)?.[0] || '').length : 0

      if (
        currentLine.trim().startsWith('- ')
        && nextLine
        && nextIndent > currentIndent
      ) {
        const question = this.cleanMarkdownFormatting(currentLine.trim().substring(2))
        const answer = this.cleanMarkdownFormatting(nextLine.trim().substring(2))

        faqs.push({
          id: generateRandomId(),
          question,
          answer,
        })

        i++ // Skip the answer line
      }
    }

    return faqs
  }

  modify(content: string, frontmatter: Record<string, any>): string {
    console.info('🌟checking faq modifier')
    const faqPattern = /::ginko-faq\s*([\s\S]*?)\s*::/g

    return content.replace(faqPattern, (match, faqContent) => {
      console.info('🌟Raw FAQ content:', faqContent)
      const faqs = this.parseFaqContent(faqContent)
      console.info('🌟Parsed FAQs:', JSON.stringify(faqs, null, 2))

      // Transform the FAQs array into the exact format matching the docs
      return `:ginko-faq{:items='${JSON.stringify(faqs)}'}`
    })
  }
}

/**
 * Converts gallery sections with images to a structured gallery component
 * Example:
 * Input:  ::ginko-gallery2
 *         :ginko-image{src="..." alt="" width="..." height="..."}
 *         ::
 * Output: :ginko-gallery2{:images='[{"src":"...","alt":"","width":"...","height":"..."}]'}
 */
export class GalleryModifier implements ContentModifier {
  private parseGinkoImage(imageLine: string): Record<string, string> | null {
    const attributes = {} as Record<string, string>
    const pattern = /:ginko-image\{([^}]+)\}/
    const match = imageLine.match(pattern)

    if (!match)
      return null

    // Extract attributes from the matched string
    const attributeString = match[1]
    const attributeMatches = attributeString.matchAll(/(\w+)="([^"]+)"/g)

    for (const attrMatch of attributeMatches) {
      const [_, key, value] = attrMatch
      attributes[key] = value
    }

    return attributes
  }

  modify(content: string, frontmatter: Record<string, any>): string {
    return content.replace(
      /::ginko-gallery2\s*([\s\S]*?)::(?:\n|$)/g,
      (match, galleryContent) => {
        // Split content into lines and filter out empty lines
        const lines = galleryContent.split('\n').filter((line: string) => line.trim())

        // Parse each ginko-image line into an object
        const images = lines
          .map((line: string) => this.parseGinkoImage(line))
          .filter((img: Record<string, string> | null): img is Record<string, string> => img !== null)

        // Return the formatted gallery component
        return `:ginko-gallery2{:images='${JSON.stringify(images)}'}`
      },
    )
  }
}

export class HighlightModifier implements ContentModifier {
  modify(content: string, frontmatter: Record<string, any>): string {
    // Replace ==text== with <mark>text</mark>
    // The regex ensures there's no whitespace between == and the content
    return content.replace(/==([^=\n]+)==/g, '<mark>$1</mark>')
  }
}
