import type { ContentModifier } from '../../markdownModifier'
import { stripMarkdown } from '../../utils/markdown'

export class CalloutModifier implements ContentModifier {
  modify(content: string): string {
    // Match Obsidian-style callouts and convert them to ginko-callout format
    const calloutRegex: RegExp = /^>\s*\[!\s*(\w+)\](\-?)\s*(.*)?\n((?:>(?:>\s*.*|>\s*)(?:\n|$))*)/gm;

    let processedContent = content.replace(calloutRegex, (match: string, type: string, collapsible: string, titleLine: string | undefined, content: string) => {
      // Clean up the content by removing the leading '> ' from each line
      // and preserving empty lines within the callout
      const cleanContent = content
        .split('\n')
        .map((line: string) => {
          // Handle empty lines that only contain '>'
          if (line.trim() === '>') return '';
          // Remove leading '> ' while preserving indentation
          return line.replace(/^>\s?/, '');
        })
        .join('\n')
        .replace(/\n{3,}/g, '\n\n') // Replace multiple consecutive newlines with double newlines
        .trim();

      // Determine if callout is collapsed (has the '-' symbol)
      const isCollapsed = collapsible === '-' ? ' collapsed' : '';

      // Extract title if present
      const title = titleLine?.trim();
      const titleAttr = title ? ` title="${title}"` : '';

      // Construct the ginko-callout
      return `::ginko-callout{type="${type.toLowerCase()}"${titleAttr}${isCollapsed}}\n${cleanContent}\n::`;
    });

    // Ensure proper spacing between callouts by adding an extra newline
    processedContent = processedContent.replace(/\n::\n::/g, '\n::\n\n::');

    return processedContent;
  }
}

