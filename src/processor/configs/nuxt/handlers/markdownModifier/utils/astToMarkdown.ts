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

      // Special handling for questions property - use single quotes
      if (prop.name === 'questions') {
        return `:${prop.name}='${prop.value}'`;
      }

      // For string values, use the standard format
      return `${prop.name}="${prop.value}"`;
    })
    .filter(Boolean) // Remove null values (false booleans)
    .join(' ');

  return props ? `{${props}}` : '';
}

// Changed colon calculation to be 2 + nestingLevel
function getColons(nestingLevel: number): string {
  // Base colon count is 2, increasing by 1 per nesting level
  return ':'.repeat(2 + nestingLevel);
}

// Recursive helper function that keeps track of nesting level
function nodeToMarkdown(node: GinkoASTNode, nestingLevel: number = 0): string {
  if (node.type === 'text') {
    return node.content as string;
  }

  if (node.type === 'code-block') {
    // Use type assertion to access the language property
    const codeNode = node as GinkoASTNode & { language?: string };
    const language = codeNode.language || '';
    return `\`\`\`${language}\n${node.content}\`\`\`\n`;
  }

  if (node.type === 'inline-code') {
    return `\`${node.content}\``;
  }

  if (node.type === 'divider') {
    return '---\n';
  }

  if (node.type === 'inline-block') {
    const properties = propertiesToString(node.properties);
    // For inline blocks, use a single colon
    return `:${node.name}${properties}`;
  }

  if (node.type === 'block') {
    const properties = propertiesToString(node.properties);
    const prefix = 'ginko-';
    const decoratedName = node.name && node.name.startsWith(prefix) ? node.name : `${prefix}${node.name || ''}`;

    // Get the appropriate colons based on nesting level
    const colons = getColons(nestingLevel);

    // Process the content with increased nesting level for child blocks
    const blockContent = Array.isArray(node.content)
      ? node.content.map(child => nodeToMarkdown(child, nestingLevel + 1)).join('')
      : node.content || '';

    // Special case for a single text node content - keep it on the same line
    if (Array.isArray(node.content) && node.content.length === 1 && node.content[0].type === 'text') {
      return `${colons}${decoratedName}${properties}\n${blockContent}\n${colons}\n`;
    } else {
      return `${colons}${decoratedName}${properties}\n${blockContent}${colons}\n`;
    }
  }

  if (node.type === 'dash-element') {
    const properties = propertiesToString(node.properties);
    const prefix = 'ginko-';
    const decoratedName = node.name && node.name.startsWith(prefix) ? node.name : `${prefix}${node.name || ''}`;

    // For dash elements, we'll use a block-like format with label in properties
    const labelProp = node.label ? ` label="${node.label}"` : '';
    const colons = getColons(nestingLevel);

    // Process content with increased nesting level
    const content = Array.isArray(node.content)
      ? node.content.map(child => nodeToMarkdown(child, nestingLevel + 1)).join('')
      : node.content || '';

    if (content) {
      return `${colons}${decoratedName}${properties}${labelProp}\n${content}${colons}\n`;
    } else {
      // If no content, we might want a simplified format
      return `${colons}${decoratedName}${properties}${labelProp}\n${colons}\n`;
    }
  }

  return '';
}

export function astToMarkdown(ast: GinkoAST): string {
  return ast.content.map(node => nodeToMarkdown(node, 0)).join('');
}