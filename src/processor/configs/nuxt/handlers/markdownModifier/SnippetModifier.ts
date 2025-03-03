import type { BlockModifier, GinkoASTNode } from './types';

/**
 * SnippetModifier transforms snippet blocks and inline snippets
 * 
 * Input:
 * - Block: ::snippet(id="xyz") ... ::
 * - Inline: :snippet(id="xyz")
 * 
 * Output:
 * - Block: ::ginko-snippet-source{id="xyz"} ... ::
 * - Inline: :ginko-snippet{id="xyz"}
 */
export class SnippetModifier implements BlockModifier {
  /**
   * Determines if this modifier can handle the given node
   */
  canHandle(node: GinkoASTNode): boolean {
    // Handle both block and inline-block types with name 'snippet'
    return (
      (node.type === 'block' && node.name === 'snippet') ||
      (node.type === 'inline-block' && node.name === 'snippet')
    );
  }

  /**
   * Modifies the node according to the transformation rules
   */
  modifyBlock(node: GinkoASTNode): GinkoASTNode {
    // Handle block snippets (::snippet)
    if (node.type === 'block' && node.name === 'snippet') {
      return {
        type: 'block',
        name: 'ginko-snippet-source',
        properties: node.properties || [],
        content: node.content || []
      };
    }

    // Handle inline snippets (:snippet)
    if (node.type === 'inline-block' && node.name === 'snippet') {
      return {
        type: 'inline-block',
        name: 'ginko-snippet',
        properties: node.properties || []
      };
    }

    // Return the node unchanged if it doesn't match our criteria
    return node;
  }
}