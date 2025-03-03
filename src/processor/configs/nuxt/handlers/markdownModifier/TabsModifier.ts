import type { BlockModifier, GinkoASTNode } from './types';

export class TabsModifier implements BlockModifier {
  canHandle(node: GinkoASTNode): boolean {
    if (node.type !== 'block') return false;
    return node.name === 'tabs';
  }

  modifyBlock(node: GinkoASTNode): GinkoASTNode {
    if (node.type !== 'block' || node.name !== 'tabs') return node;

    // Get tab elements from content
    const tabElements = (node.content || []).filter(
      child => child.type === 'dash-element' && child.name === 'tab'
    );

    // Transform each tab dash-element into a ginko-tab block
    const tabBlocks = tabElements.map(tab => {
      if (tab.type !== 'dash-element') return tab;

      // Create properties array starting with the label if it exists
      const properties = [...(tab.properties || [])];

      // Add label property if it exists
      if (tab.label) {
        properties.push({ name: 'label', value: tab.label });
      }

      return {
        type: 'block',
        name: 'ginko-tab',
        properties: properties,
        content: tab.content || []
      };
    });

    // Return the ginko-tabs block with transformed tab blocks
    return {
      type: 'block',
      name: 'ginko-tabs',
      properties: node.properties || [],
      content: tabBlocks
    };
  }
}