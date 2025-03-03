import type { ContentModifier, GinkoAST, GinkoASTNode, BlockModifier } from './types';

export class MarkdownModifier implements ContentModifier {
  private blockModifiers: BlockModifier[];

  constructor(blockModifiers: BlockModifier[]) {
    this.blockModifiers = blockModifiers;
  }

  private modifyNode(node: GinkoASTNode): GinkoASTNode {
    if (!node || typeof node !== 'object') {
      return { type: 'text', content: '' };
    }

    // If it's a text node, return as is
    if (node.type === 'text') {
      return node;
    }

    // Try to find a modifier that can handle this block
    for (const modifier of this.blockModifiers) {
      if (modifier.canHandle(node)) {
        node = modifier.modifyBlock(node);
      }
    }

    // Recursively modify content if it exists and is an array
    if (node.content && Array.isArray(node.content)) {
      return {
        ...node,
        content: node.content.map(child => this.modifyNode(child))
      };
    }

    return node;
  }

  modify(ast: GinkoAST | { error: string } | undefined): GinkoAST | { error: string } {
    // Handle undefined input
    if (!ast) {
      return {
        type: 'document',
        content: []
      };
    }

    // Handle error case
    if ('error' in ast) {
      return ast;
    }

    // Handle invalid ast
    if (!ast.content || !Array.isArray(ast.content)) {
      return {
        type: 'document',
        content: []
      };
    }

    try {
      return {
        ...ast,
        content: ast.content.map(node => this.modifyNode(node))
      };
    } catch (error) {
      return { error: error.message || 'Unknown error during modification' };
    }
  }
} 