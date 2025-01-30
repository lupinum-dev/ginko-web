import { ContentModifier } from '../../markdownModifier'
import { stripMarkdown } from '../../utils/markdown'

export class CalloutModifier implements ContentModifier {
  // Split into two separate regexes for better clarity and maintenance
  private readonly STANDARD_CALLOUT_REGEX = /^> \[!(\w+)\](-?)(?: (.*?))?\n((?:>.*(?:\n|$))*)/gm
  private readonly SIMPLE_CALLOUT_REGEX = /^::(\w+)\n([\s\S]*?)^::/gm
  private readonly GINKO_IMAGE_REGEX = /:ginko-image{([^}]*)}/g
  private readonly CARD_LINK_REGEX = /@to="?\[.*?\]\((.*?)\)"?/
  private readonly CARD_TARGET_REGEX = /@target="(.*?)"/
  private readonly CARD_ICON_REGEX = /@icon="(.*?)"/

  modify(content: string): string {
    // First handle standard callouts
    let processedContent = content.replace(this.STANDARD_CALLOUT_REGEX, 
      (_, type, foldable, title, bodyLines) => {
        const body = bodyLines
          ? bodyLines
              .split('\n')
              .map((line: string) => line.replace(/^>\s?/, '').trimEnd())
              .filter((line: string) => line !== '')
              .join('\n')
          : ''

        // Handle cards differently
        if (type.toLowerCase() === 'card') {
          return this.formatCard(title, body)
        }

        return this.formatCallout(type, foldable, title, body)
      }
    )

    // Then handle simple callouts
    processedContent = processedContent.replace(this.SIMPLE_CALLOUT_REGEX,
      (_, type, body) => {
        return this.formatCallout(type, null, null, body.trim())
      }
    )

    return processedContent
  }

  private formatCard(title: string | null, body: string): string {
    const props: string[] = []
    
    if (title) {
      props.push(`title="${stripMarkdown(title)}"`)
    }

    // Extract image details if present
    const imageMatch = body.match(this.GINKO_IMAGE_REGEX)
    if (imageMatch) {
      const imgProps = imageMatch[0].match(/{([^}]*)}/)
      if (imgProps) {
        const propString = imgProps[1]
        const srcMatch = propString.match(/src="([^"]*)"/)
        const altMatch = propString.match(/alt="([^"]*)"/)
        const widthMatch = propString.match(/width="([^"]*)"/)
        const heightMatch = propString.match(/height="([^"]*)"/)

        if (srcMatch) props.push(`img-src="${srcMatch[1]}"`)
        if (altMatch) props.push(`img-alt="${altMatch[1]}"`)
        if (widthMatch) props.push(`img-width="${widthMatch[1]}"`)
        if (heightMatch) props.push(`img-height="${heightMatch[1]}"`)

        // Remove the image syntax from body
        body = body.replace(this.GINKO_IMAGE_REGEX, '')
      }
    }

    // Extract link, target, and icon if present
    const linkMatch = body.match(this.CARD_LINK_REGEX)
    if (linkMatch) {
      props.push(`to="${linkMatch[1]}"`)
      body = body.replace(this.CARD_LINK_REGEX, '')
    }

    const targetMatch = body.match(this.CARD_TARGET_REGEX)
    if (targetMatch) {
      props.push(`target="${targetMatch[1]}"`)
      body = body.replace(this.CARD_TARGET_REGEX, '')
    }

    const iconMatch = body.match(this.CARD_ICON_REGEX)
    if (iconMatch) {
      props.push(`icon="${iconMatch[1]}"`)
      body = body.replace(this.CARD_ICON_REGEX, '')
    }

    const propsString = props.length > 0 ? `{${props.join(' ')}}` : ''
    
    // Clean up the body: remove empty lines and trim
    body = body.split('\n')
      .filter(line => line.trim())
      .join('\n')
      .trim()

    if (!body) {
      return `::ginko-card${propsString}\n::`
    }

    return `::ginko-card${propsString}\n${body}\n::`
  }

  private formatCallout(type: string, foldable: string | null, title: string | null, body: string): string {
    // Build the callout properties
    const props: string[] = [`type="${type.toLowerCase()}"`]
    
    if (title) {
      props.push(`title="${stripMarkdown(title)}"`)
    }

    if (foldable === '-') {
      props.push('folded')
    }

    // Add nobleed to ginko-images
    const bodyWithNoBleedImages = this.addNoBleedToImages(body)

    // Handle nested callouts recursively
    const processedBody = this.modify(bodyWithNoBleedImages)

    // Generate the callout
    const propsString = props.join(' ')
    
    if (!processedBody) {
      return `::ginko-callout{${propsString}}\n::`
    }

    return `::ginko-callout{${propsString}}\n${processedBody}\n::`
  }

  private addNoBleedToImages(content: string): string {
    return content.replace(this.GINKO_IMAGE_REGEX, (match, props) => {
      if (!props.includes('nobleed')) {
        return `:ginko-image{${props} nobleed}`
      }
      return match
    })
  }
} 