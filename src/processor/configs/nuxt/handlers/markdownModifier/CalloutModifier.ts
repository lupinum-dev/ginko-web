import type { BlockModifier, GinkoASTNode } from './types';

const VALID_CALLOUT_TYPES = ['note', 'tip', 'info', 'warning', 'danger', 'quote'] as const;
type CalloutType = typeof VALID_CALLOUT_TYPES[number];

export class CalloutModifier implements BlockModifier {
  canHandle(node: GinkoASTNode): boolean {
    // Check if it's a block and has a name
    if (node.type !== 'block' || !node.name) return false;

    // Check if the base name (without -) matches valid types
    const baseType = node.name.replace(/-$/, '');
    return VALID_CALLOUT_TYPES.includes(baseType as CalloutType);
  }

  modifyBlock(node: GinkoASTNode): GinkoASTNode {
    if (!this.canHandle(node) || !node.name) {
      return node;
    }

    const baseType = node.name.replace(/-$/, '');
    const isCollapsible = node.name.endsWith('-');

    // Initialize properties array with type-safe values
    const properties: Array<{ name: string; value: string | boolean }> = [
      { name: 'type', value: baseType as CalloutType }
    ];

    // Add collapsible property if needed
    if (isCollapsible) {
      properties.push({ name: 'collapsed', value: true });
    }

    // Process content to find title
    const modifiedContent: GinkoASTNode[] = [];
    let title: string | undefined;

    if (Array.isArray(node.content)) {
      for (const child of node.content) {
        if (child.type === 'dash-element' && child.name === 'title' && child.label) {
          title = child.label;
        } else {
          modifiedContent.push(child);
        }
      }
    }

    // Add title to properties if found
    if (title) {
      properties.push({ name: 'title', value: title });
    }

    // Add any existing properties that don't conflict
    const existingProps = node.properties || [];
    for (const prop of existingProps) {
      if (!properties.some(p => p.name === prop.name)) {
        properties.push({ name: prop.name, value: prop.value });
      }
    }

    return {
      ...node,
      name: 'ginko-callout',
      properties,
      content: modifiedContent.length > 0 ? modifiedContent : node.content
    };
  }
}
