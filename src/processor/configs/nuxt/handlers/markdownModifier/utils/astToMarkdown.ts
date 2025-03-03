import type { GinkoAST, GinkoASTNode } from '../types';

function propertiesToString(properties: Array<{ name: string; value: string | boolean }> = []): string {
  if (properties.length === 0) return '';

  const props = properties
    .map(prop => {
      // Handle boolean values
      if (typeof prop.value === 'boolean') {
        // For true values, just output the property name without a value
        return prop.value === true ? `${prop.name}` : null;
      }
      // For string values, use the standard format
      return `${prop.name}="${prop.value}"`;
    })
    .filter(Boolean) // Remove null values (false booleans)
    .join(' ');

  return `{${props}}`;
}

function nodeToMarkdown(node: GinkoASTNode): string {
  if (node.type === 'text') {
    return node.content as string;
  }

  if (node.type === 'block') {
    const blockContent = Array.isArray(node.content)
      ? node.content.map(child => nodeToMarkdown(child)).join('')
      : node.content || '';

    const properties = propertiesToString(node.properties);
    // Ensure proper formatting with newlines between content and closing tag
    return `::${node.name}${properties}\n${blockContent}\n::\n`;
  }

  return '';
}

export function astToMarkdown(ast: GinkoAST): string {
  return ast.content.map(node => nodeToMarkdown(node)).join('');
} 