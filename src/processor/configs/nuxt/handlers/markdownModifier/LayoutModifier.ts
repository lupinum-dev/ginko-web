import type { BlockModifier, GinkoASTNode } from './types';

export class LayoutModifier implements BlockModifier {
  canHandle(node: GinkoASTNode): boolean {
    if (node.type !== 'block') return false;
    return node.name === 'layout';
  }

  modifyBlock(node: GinkoASTNode): GinkoASTNode {
    if (node.type !== 'block' || node.name !== 'layout') return node;

    // Get columns from content (--col dash elements)
    const columns = (node.content || []).filter(
      child => child.type === 'dash-element' && child.name === 'col'
    );

    // Handle single column case - should transform to ginko-center
    if (columns.length === 1) {
      const column = columns[0];

      // If the column has a label, we need to add it as content
      let content = column.content || [];
      if (column.label) {
        // Add the label as a text node if not already in content
        content = [
          { type: 'text', content: column.label },
          ...(Array.isArray(content) ? content : [])
        ];
      }

      return {
        type: 'block',
        name: 'ginko-center',
        properties: [],
        content: content
      };
    }

    // Handle multiple columns - transform to ginko-layout with ginko-column children
    const columnNodes = columns.map(col => {
      // Handle column label
      let content = col.content || [];
      if (col.label) {
        content = [
          { type: 'text', content: col.label },
          ...(Array.isArray(content) ? content : [])
        ];
      }

      return {
        type: 'block',
        name: 'ginko-column',
        properties: col.properties || [],
        content: content
      };
    });

    return {
      type: 'block',
      name: 'ginko-layout',
      properties: node.properties || [],
      content: columnNodes
    };
  }
}