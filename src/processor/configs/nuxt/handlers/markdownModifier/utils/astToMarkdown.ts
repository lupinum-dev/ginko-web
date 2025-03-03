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

// The nesting rules are:
// 1. ginko-layout: Always has three colons on opening and closing (:::)
// 2. ginko-column: Always has two colons (::)
// 3. ginko-center: Always has two colons (::)
// 4. ginko-callout: Has four colons on opening and closing (::::)

function getColons(nodeName: string, nestingLevel: number, isClosing: boolean = false): string {
  if (nodeName === 'ginko-column') {
    return '::'; // Always 2 colons
  } else if (nodeName === 'ginko-layout') {
    return ':::'; // Always 3 colons
  } else if (nodeName === 'ginko-center') {
    return '::'; // Always 2 colons
  } else if (nodeName === 'ginko-callout') {
    return '::::'; // Always 4 colons
  } else {
    // Default based on nesting level
    return ':'.repeat(Math.max(2, 2 + nestingLevel));
  }
}

// Recursive helper function that keeps track of nesting level
function nodeToMarkdown(node: GinkoASTNode, nestingLevel: number = 0): string {
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
    const properties = propertiesToString(node.properties);

    // Get the appropriate opening and closing colons based on node name
    const openingColons = getColons(node.name || '', nestingLevel);
    const closingColons = getColons(node.name || '', nestingLevel);

    // Process the content with increased nesting level for child blocks
    const blockContent = Array.isArray(node.content)
      ? node.content.map(child => nodeToMarkdown(child, nestingLevel + 1)).join('')
      : node.content || '';

    // Special case for a single text node content - keep it on the same line
    if (Array.isArray(node.content) && node.content.length === 1 && node.content[0].type === 'text') {
      return `${openingColons}${node.name}${properties}\n${blockContent}\n${closingColons}\n`;
    } else {
      return `${openingColons}${node.name}${properties}\n${blockContent}${closingColons}\n`;
    }
  }

  if (node.type === 'dash-element') {
    const properties = propertiesToString(node.properties);
    const label = node.label ? ` ${node.label}` : '';
    const content = Array.isArray(node.content)
      ? node.content.map(child => nodeToMarkdown(child, nestingLevel)).join('')
      : node.content || '';
    return `--${node.name}${properties}${label}\n${content}`;
  }

  return '';
}

export function astToMarkdown(ast: GinkoAST): string {
  return ast.content.map(node => nodeToMarkdown(node, 0)).join('');
}

