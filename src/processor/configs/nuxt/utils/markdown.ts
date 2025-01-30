export function stripMarkdown(text: string): string {
  return text
    .replace(/[#*_\[\]`~]/g, '') // Remove Markdown syntax characters
    .replace(/\s+/g, ' ')        // Normalize whitespace
    .trim()
}