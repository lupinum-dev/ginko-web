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

  return props ? `{${props}}` : '';
}

function nodeToMarkdown(node: GinkoASTNode): string {
  if (node.type === 'text') {
    return node.content as string;
  }

  if (node.type === 'code-block') {
    const language = node.language ? node.language : '';
    return `\`\`\`${language}\n${node.content}\`\`\`\n`;
  }

  if (node.type === 'inline-code') {
    return `\`${node.content}\``;
  }

  if (node.type === 'divider') {
    return '---\n';
  }

  if (node.type === 'block') {
    const blockContent = Array.isArray(node.content)
      ? node.content.map(child => nodeToMarkdown(child)).join('')
      : node.content || '';

    const properties = propertiesToString(node.properties);

    // Special handling for ginko-callout blocks
    if (node.name === 'ginko-callout') {
      return `::${node.name}${properties}\n${blockContent}::\n`;
    }

    // For other blocks, ensure proper formatting with newlines
    return `::${node.name}${properties}\n${blockContent}::\n`;
  }

  if (node.type === 'dash-element') {
    const properties = propertiesToString(node.properties);
    const label = node.label ? ` ${node.label}` : '';
    const content = Array.isArray(node.content)
      ? node.content.map(child => nodeToMarkdown(child)).join('')
      : node.content || '';
    return `--${node.name}${properties}${label}\n${content}`;
  }

  return '';
}

export function astToMarkdown(ast: GinkoAST): string {
  return ast.content.map(node => nodeToMarkdown(node)).join('');
} 