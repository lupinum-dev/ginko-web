import type { BlockModifier, GinkoASTNode } from './types';

const VALID_TYPES = ['note', 'info', 'danger', 'warning', 'quote', 'question', 'tip'] as const;
type CalloutType = typeof VALID_TYPES[number];

export class CalloutModifier implements BlockModifier {
  canHandle(node: GinkoASTNode): boolean {
    if (node.type !== 'block') return false;
    if (!node.name) return false;

    // Handle both normal and collapsed variants (e.g., 'note' and 'note-')
    const baseType = node.name.replace(/-$/, '');
    return VALID_TYPES.includes(baseType as CalloutType);
  }

  modifyBlock(node: GinkoASTNode): GinkoASTNode {
    if (node.type !== 'block' || !node.name) return node;

    const isCollapsed = node.name.endsWith('-');
    const type = node.name.replace(/-$/, '') as CalloutType;

    // Start with the base properties
    const properties: Array<{ name: string; value: string | boolean }> = [
      { name: 'type', value: type }
    ];

    // Add collapsed property if needed
    if (isCollapsed) {
      properties.push({ name: 'collapsed', value: true });
    }

    // Handle title from properties or --title element
    if (node.content && Array.isArray(node.content)) {
      const titleElement = node.content.find(
        child => child.type === 'dash-element' && child.name === 'title'
      );

      if (titleElement && titleElement.label) {
        properties.push({ name: 'title', value: titleElement.label });

        // Get the content from the title element if it exists
        const titleContent = titleElement.content && Array.isArray(titleElement.content)
          ? titleElement.content
          : [];

        // Remove the title element from content and add its content
        node.content = [
          ...titleContent,
          ...node.content.filter(child => child !== titleElement)
        ];
      }
    }

    // Add any existing properties from the original block
    if (node.properties) {
      for (const prop of node.properties) {
        // Don't duplicate title if it was already set
        if (prop.name === 'title' && !properties.some(p => p.name === 'title')) {
          properties.push(prop);
        } else if (prop.name !== 'title') {
          properties.push(prop);
        }
      }
    }

    return {
      type: 'block',
      name: 'ginko-callout',
      properties,
      content: node.content
    };
  }
}
