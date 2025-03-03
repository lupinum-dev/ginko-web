import type { GinkoAST, GinkoASTNode } from '../types';

function propertiesToString(properties: Array<{ name: string; value: string }> = []): string {
  if (properties.length === 0) return '';

  const props = properties
    .map(prop => `${prop.name}="${prop.value}"`)
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
    return `::${node.name}${properties}\n${blockContent}::\n`;
  }

  return '';
}

export function astToMarkdown(ast: GinkoAST): string {
  return ast.content.map(node => nodeToMarkdown(node)).join('');
} 