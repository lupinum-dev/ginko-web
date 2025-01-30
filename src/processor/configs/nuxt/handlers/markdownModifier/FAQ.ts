import type { ContentModifier } from '../../markdownModifier'
import { stripMarkdown } from '../../utils/markdown'

export class FaqModifier implements ContentModifier {
  private readonly FAQ_BLOCK_REGEX = /^\+\+faq\n([\s\S]*?)^\+\+/gm
  private readonly GINKO_IMAGE_REGEX = /:ginko-image\{([^}]*)\}/g

  modify(content: string): string {
    return content.replace(this.FAQ_BLOCK_REGEX, (_, faqContent) => {
      // First try to parse as bullet style
      const bulletItems = this.parseBulletStyle(faqContent)
      if (bulletItems.length > 0) {
        return this.formatFaq(bulletItems)
      }

      // If no bullet items found, try markdown style
      const markdownItems = this.parseMarkdownStyle(faqContent)
      return this.formatFaq(markdownItems)
    })
  }

  private addNoBleedToImages(content: string): string {
    return content.replace(this.GINKO_IMAGE_REGEX, (match, props) => {
      if (!props.includes('nobleed')) {
        return `:ginko-image{${props} nobleed}`
      }
      return match
    })
  }

  private parseBulletStyle(content: string): Array<{ title: string, answer: string }> {
    const items: Array<{ title: string, answer: string }> = []
    const lines = content.split('\n')
    let currentQuestion: string | null = null
    let currentAnswer: string[] = []

    for (const line of lines) {
      const questionMatch = line.match(/^-\s*(?:\*\*|###?\s*)(.*?)(?:\*\*)?$/)
      const answerMatch = line.match(/^\s*-\s*(.+)$/)

      if (questionMatch) {
        // Save previous QA pair if exists
        if (currentQuestion && currentAnswer.length > 0) {
          items.push({
            title: stripMarkdown(currentQuestion),
            answer: currentAnswer.join('\n').trim(),
          })
          currentAnswer = []
        }
        currentQuestion = questionMatch[1].trim()
      }
      else if (answerMatch && currentQuestion) {
        currentAnswer.push(answerMatch[1].trim())
      }
    }

    // Add the last QA pair
    if (currentQuestion && currentAnswer.length > 0) {
      items.push({
        title: stripMarkdown(currentQuestion),
        answer: currentAnswer.join('\n').trim(),
      })
    }

    return items
  }

  private parseMarkdownStyle(content: string): Array<{ title: string, answer: string }> {
    const items: Array<{ title: string, answer: string }> = []
    const sections = content.split(/(?=^#{2,4}\s)/m)

    for (const section of sections) {
      if (!section.trim())
        continue

      const lines = section.split('\n')
      const titleMatch = lines[0].match(/^#{2,4}\s+(.+)$/)

      if (titleMatch) {
        const title = titleMatch[1].trim()
        const answer = lines.slice(1).join('\n').trim()

        if (title && answer) {
          items.push({
            title: stripMarkdown(title),
            answer,
          })
        }
      }
    }

    return items
  }

  private formatFaq(items: Array<{ title: string, answer: string }>): string {
    if (items.length === 0) {
      return '::ginko-faq\n::'
    }

    const faqItems = items
      .map(({ title, answer }) => {
        const processedAnswer = this.addNoBleedToImages(answer)
        return `\t::ginko-faq-item{title="${title}"}\n\t${processedAnswer}\n\t::`
      })
      .join('\n')

    return `::ginko-faq\n${faqItems}\n::`
  }
}
