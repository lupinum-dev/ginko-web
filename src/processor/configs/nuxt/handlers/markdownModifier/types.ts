export interface GinkoASTNode {
  type: string;
  content?: string | GinkoASTNode[];
  name?: string;
  properties?: Array<{ name: string; value: string | boolean }>;
  label?: string;
}

export interface GinkoAST {
  type: 'document';
  content: GinkoASTNode[];
}

export interface ContentModifier {
  modify(ast: GinkoAST | { error: string }): GinkoAST | { error: string };
}

export interface BlockModifier {
  canHandle(node: GinkoASTNode): boolean;
  modifyBlock(node: GinkoASTNode): GinkoASTNode;
} 