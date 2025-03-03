// ============================================================================
// Pre-compiled Regular Expressions
// ============================================================================

const BLOCK_START_REGEX = /^::([a-zA-Z0-9_-]+)(?:\s*[\({]([^)}\n]*)[\)}])?\s*\n/;
const BLOCK_END_REGEX = /^::\s*\n?/;
const DASH_ELEMENT_REGEX = /^--([a-zA-Z][a-zA-Z0-9_-]*)(?:[\({]([^)}\n]*)[\)}])?\s+(.*?)(?=\n|$)/;
const CODE_BLOCK_START_REGEX = /^```([^\n]*)\n/;
const INLINE_CODE_REGEX = /^`([^`]+)`/;
const PROPERTY_REGEX = /([a-zA-Z0-9_-]+)(?:=(?:['"]([^'"]*)['"](}|\))?|(true|false|[0-9]+(?:\.[0-9]+)?)))?/g;
const DIVIDER_REGEX = /^-{3,}\s*\n?/;
const INLINE_BLOCK_REGEX = /^:([a-zA-Z0-9_\[\]]+)(?:[\({]([^)}\n]*)[\)}]|\{([^}]*)\})/;

// ============================================================================
// Types
// ============================================================================

/** Represents a property with name and typed value */
interface Property {
  name: string;
  value: string | boolean | number;
}

/** Base interface for all AST nodes */
interface Node {
  type: string;
  content?: string | Node[];
  language?: string;
}

/** Text content node */
interface TextNode extends Node {
  type: 'text';
  content: string;
}

/** Code block node */
interface CodeBlockNode extends Node {
  type: 'code-block';
  language?: string;
  content: string;
}

/** Dash-prefixed element node */
interface DashElementNode extends Node {
  type: 'dash-element';
  name: string;
  properties: Property[];
  content: Node[];
  label?: string;
}

/** Block node with opening and closing tags */
interface BlockNode extends Node {
  type: 'block';
  name: string;
  properties: Property[];
  content: Node[];
}

/** Root document node */
interface DocumentNode extends Node {
  type: 'document';
  content: Node[];
}

/** Inline code node */
interface InlineCodeNode extends Node {
  type: 'inline-code';
  content: string;
}

/** Divider node */
interface DividerNode extends Node {
  type: 'divider';
}

/** Inline block node - New node type for inline blocks */
interface InlineBlockNode extends Node {
  type: 'inline-block';
  name: string;
  properties: Property[];
}

/** All possible token types */
type TokenType =
  | 'BLOCK_START'    // ::name(props)
  | 'BLOCK_END'      // ::
  | 'DASH_ELEMENT'   // --name(props)
  | 'CODE_BLOCK_START' // ```
  | 'CODE_BLOCK_END'   // ```
  | 'CODE_BLOCK_CONTENT' // Content inside code block
  | 'INLINE_CODE'    // `code`
  | 'INLINE_BLOCK'   // :name(props)
  | 'DIVIDER'        // ---
  | 'TEXT';          // Any other content

/** Token representing a parsed piece of input */
interface Token {
  type: TokenType;
  value: string;
  name?: string;
  properties?: string;
  language?: string;
  line: number;
  label?: string;
}

/** Parser error with line information */
class ParserError extends Error {
  readonly line: number;

  constructor(message: string, line = 0) {
    super(`Line ${line}: ${message}`);
    this.line = line;
    this.name = 'ParserError';
  }
}

// ============================================================================
// Node Pool for Memory Optimization
// ============================================================================

/**
 * Object pool for frequently created node types to reduce GC pressure
 */
class NodePool {
  private textNodes: TextNode[] = [];
  private textNodeIndex = 0;

  private blockNodes: BlockNode[] = [];
  private blockNodeIndex = 0;

  private dashElementNodes: DashElementNode[] = [];
  private dashElementIndex = 0;

  // New pool for inline block nodes
  private inlineBlockNodes: InlineBlockNode[] = [];
  private inlineBlockIndex = 0;

  reset(): void {
    this.textNodeIndex = 0;
    this.blockNodeIndex = 0;
    this.dashElementIndex = 0;
    this.inlineBlockIndex = 0;
  }

  getText(content: string): TextNode {
    if (this.textNodeIndex < this.textNodes.length) {
      const node = this.textNodes[this.textNodeIndex++];
      node.content = content;
      return node;
    }

    const node: TextNode = { type: 'text', content };
    this.textNodes.push(node);
    this.textNodeIndex++;
    return node;
  }

  getBlock(name: string, properties: Property[]): BlockNode {
    if (this.blockNodeIndex < this.blockNodes.length) {
      const node = this.blockNodes[this.blockNodeIndex++];
      node.name = name;
      node.properties = properties;
      node.content.length = 0;
      return node;
    }

    const node: BlockNode = {
      type: 'block',
      name,
      properties,
      content: []
    };
    this.blockNodes.push(node);
    this.blockNodeIndex++;
    return node;
  }

  getDashElement(name: string, properties: Property[], label?: string): DashElementNode {
    if (this.dashElementIndex < this.dashElementNodes.length) {
      const node = this.dashElementNodes[this.dashElementIndex++];
      node.name = name;
      node.properties = properties;
      node.label = label;
      node.content.length = 0;
      return node;
    }

    const node: DashElementNode = {
      type: 'dash-element',
      name,
      properties,
      content: [],
      label
    };
    this.dashElementNodes.push(node);
    this.dashElementIndex++;
    return node;
  }

  // New method for inline block nodes
  getInlineBlock(name: string, properties: Property[]): InlineBlockNode {
    if (this.inlineBlockIndex < this.inlineBlockNodes.length) {
      const node = this.inlineBlockNodes[this.inlineBlockIndex++];
      node.name = name;
      node.properties = properties;
      return node;
    }

    const node: InlineBlockNode = {
      type: 'inline-block',
      name,
      properties
    };
    this.inlineBlockNodes.push(node);
    this.inlineBlockIndex++;
    return node;
  }
}

// Create a global node pool
const nodePool = new NodePool();

// ============================================================================
// Caching System
// ============================================================================

/**
 * Simple LRU cache for parsed results
 */
class ParseCache {
  private static readonly MAX_SIZE = 100;
  private static readonly cache = new Map<string, DocumentNode | { error: string }>();
  private static readonly keys: string[] = [];

  static get(key: string): DocumentNode | { error: string } | undefined {
    return this.cache.get(key);
  }

  static set(key: string, value: DocumentNode | { error: string }): void {
    const existingIndex = this.keys.indexOf(key);
    if (existingIndex >= 0) {
      this.keys.splice(existingIndex, 1);
    } else if (this.keys.length >= this.MAX_SIZE) {
      const oldest = this.keys.shift();
      if (oldest) this.cache.delete(oldest);
    }

    this.keys.push(key);
    this.cache.set(key, value);
  }

  static clear(): void {
    this.cache.clear();
    this.keys.length = 0;
  }
}

// ============================================================================
// Tokenizer
// ============================================================================

/**
 * Tokenize the input string into semantic tokens - O(n) implementation
 * Updated to handle inline blocks
 */
function tokenize(input: string): Token[] {
  // Pre-calculate line indices for O(log n) line number lookups
  const lineIndices: number[] = [0];
  for (let i = 0; i < input.length; i++) {
    if (input[i] === '\n') {
      lineIndices.push(i + 1);
    }
  }

  // Binary search for line number
  const getLineNumber = (pos: number): number => {
    let low = 0;
    let high = lineIndices.length;

    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (lineIndices[mid] <= pos) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }

    return low;
  };

  // Estimate token count for pre-allocation
  const estimatedTokenCount = Math.max(10, Math.ceil(input.length / 10));
  const tokens: Token[] = new Array(estimatedTokenCount);
  let tokenCount = 0;

  let position = 0;
  let insideCodeBlock = false;

  while (position < input.length) {
    const currentLine = getLineNumber(position);
    const remaining = input.slice(position);

    // Fast path for code blocks which can be large
    if (insideCodeBlock) {
      const codeBlockEndPos = remaining.indexOf('```');

      if (codeBlockEndPos === -1) {
        tokens[tokenCount++] = {
          type: 'CODE_BLOCK_CONTENT',
          value: remaining,
          line: currentLine
        };
        position = input.length;
      } else {
        if (codeBlockEndPos > 0) {
          tokens[tokenCount++] = {
            type: 'CODE_BLOCK_CONTENT',
            value: remaining.slice(0, codeBlockEndPos),
            line: currentLine
          };
        }

        tokens[tokenCount++] = {
          type: 'CODE_BLOCK_END',
          value: '```',
          line: getLineNumber(position + codeBlockEndPos)
        };

        position += codeBlockEndPos + 3;
        insideCodeBlock = false;
      }
      continue;
    }

    // Match tokens using pre-compiled regex for performance
    let match;

    // 1. Code block start
    if ((match = CODE_BLOCK_START_REGEX.exec(remaining))) {
      tokens[tokenCount++] = {
        type: 'CODE_BLOCK_START',
        value: match[0],
        language: match[1].trim(),
        line: currentLine
      };
      position += match[0].length;
      insideCodeBlock = true;
      continue;
    }

    // 2. Inline code
    if ((match = INLINE_CODE_REGEX.exec(remaining))) {
      tokens[tokenCount++] = {
        type: 'INLINE_CODE',
        value: match[1],
        line: currentLine
      };
      position += match[0].length;
      continue;
    }

    // 2.5 Divider
    if ((match = DIVIDER_REGEX.exec(remaining))) {
      tokens[tokenCount++] = {
        type: 'DIVIDER',
        value: match[0],
        line: currentLine
      };
      position += match[0].length;
      continue;
    }

    // 3. Block start
    if ((match = BLOCK_START_REGEX.exec(remaining))) {
      tokens[tokenCount++] = {
        type: 'BLOCK_START',
        value: match[0],
        name: match[1],
        properties: match[2]?.trim() || '',
        line: currentLine
      };
      position += match[0].length;
      continue;
    }

    // 3.5 Inline Block - New token type
    if ((match = INLINE_BLOCK_REGEX.exec(remaining))) {
      // Extract full matched text
      const fullMatch = match[0];
      // Extract block name
      const blockName = match[1];
      // Extract properties (from either parentheses or curly braces)
      const properties = match[2] || match[3] || '';

      tokens[tokenCount++] = {
        type: 'INLINE_BLOCK',
        value: fullMatch,
        name: blockName,
        properties: properties,
        line: currentLine
      };
      position += fullMatch.length;
      continue;
    }

    // 4. Dash element
    if ((match = DASH_ELEMENT_REGEX.exec(remaining))) {
      tokens[tokenCount++] = {
        type: 'DASH_ELEMENT',
        value: match[0],
        name: match[1],
        properties: match[2]?.trim() || '',
        label: match[3].trim(),
        line: currentLine
      };
      position += match[0].length;
      if (remaining[match[0].length] === '\n') {
        position += 1;
      }
      continue;
    }

    // 5. Block end
    if ((match = BLOCK_END_REGEX.exec(remaining))) {
      tokens[tokenCount++] = {
        type: 'BLOCK_END',
        value: '::',
        line: currentLine
      };
      position += match[0].length;
      continue;
    }

    // Efficient next token position finding
    // Instead of multiple indexOf calls, use a single pass to find the minimum position
    const nextPositions = [
      { type: 'block', pos: remaining.indexOf('::') },
      { type: 'dash', pos: remaining.indexOf('--') },
      { type: 'code', pos: remaining.indexOf('```') },
      { type: 'inline', pos: remaining.indexOf('`') },
      { type: 'inlineBlock', pos: remaining.indexOf(':') } // Add check for inline blocks
    ].filter(item => item.pos >= 0);

    // Sort by position to find the closest token
    nextPositions.sort((a, b) => a.pos - b.pos);

    if (nextPositions.length === 0) {
      // No more tokens, the rest is text
      tokens[tokenCount++] = {
        type: 'TEXT',
        value: remaining,
        line: currentLine
      };
      position = input.length;
    } else if (nextPositions[0].pos > 0) {
      // Text before the next token
      tokens[tokenCount++] = {
        type: 'TEXT',
        value: remaining.slice(0, nextPositions[0].pos),
        line: currentLine
      };
      position += nextPositions[0].pos;
    } else {
      // We're at a token-like sequence that didn't match patterns
      // Just treat the next character as text
      tokens[tokenCount++] = {
        type: 'TEXT',
        value: remaining[0],
        line: currentLine
      };
      position += 1;
    }
  }

  return tokenCount === tokens.length ? tokens : tokens.slice(0, tokenCount);
}

// ============================================================================
// Property Parser
// ============================================================================

/**
 * Parse properties string into structured Property objects
 * Optimized with pre-compiled regex and efficient string handling
 */
function parseProperties(propString: string): Property[] {
  if (!propString || propString.trim() === '') return [];

  // Pre-allocate array based on estimated property count
  const estimatedCount = Math.max(1, Math.ceil(propString.length / 10));
  const properties: Property[] = new Array(estimatedCount);
  let propCount = 0;

  // Reset regex state
  PROPERTY_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = PROPERTY_REGEX.exec(propString)) !== null) {
    const name = match[1];
    let value: string | boolean | number;

    if (match[2] !== undefined) {
      // String value in quotes
      value = match[2];
    } else if (match[4] !== undefined) {
      // Boolean or number
      if (match[4] === 'true') value = true;
      else if (match[4] === 'false') value = false;
      else value = +match[4]; // Unary plus is faster than Number()
    } else {
      // Flag without value (implicit true)
      value = true;
    }

    properties[propCount++] = { name, value };
  }

  return propCount === properties.length ? properties : properties.slice(0, propCount);
}

// ============================================================================
// Parser
// ============================================================================

/**
 * Main parser implementation - optimized for speed and memory efficiency
 * Updated to handle inline blocks
 */
function parse(input: string): DocumentNode {
  // Reset node pool
  nodePool.reset();

  // Tokenize input using optimized tokenizer
  const tokens = tokenize(input);

  // Create document root
  const document: DocumentNode = { type: 'document', content: [] };

  // Use array for stack instead of recursion
  const stack: (BlockNode | DocumentNode)[] = [document];

  // Text buffer optimization
  let textBuffer = '';
  let textLine = 0;

  // Code block tracking
  let codeBlockContent = '';
  let codeBlockLanguage = '';
  let inCodeBlock = false;

  // Helper to flush text buffer
  const flushTextBuffer = () => {
    if (textBuffer) {
      const currentParent = stack[stack.length - 1];
      currentParent.content.push(nodePool.getText(textBuffer));
      textBuffer = '';
    }
  };

  // Process tokens
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const currentParent = stack[stack.length - 1];

    switch (token.type) {
      case 'CODE_BLOCK_START': {
        flushTextBuffer();
        inCodeBlock = true;
        codeBlockContent = '';
        codeBlockLanguage = token.language || '';
        break;
      }

      case 'CODE_BLOCK_CONTENT': {
        if (inCodeBlock) {
          codeBlockContent += token.value;
        } else {
          if (!textBuffer) textLine = token.line;
          textBuffer += token.value;
        }
        break;
      }

      case 'CODE_BLOCK_END': {
        if (inCodeBlock) {
          currentParent.content.push({
            type: 'code-block',
            language: codeBlockLanguage || undefined,
            content: codeBlockContent
          });

          inCodeBlock = false;
          codeBlockContent = '';
          codeBlockLanguage = '';
        } else {
          if (!textBuffer) textLine = token.line;
          textBuffer += token.value;
        }
        break;
      }

      case 'BLOCK_START': {
        flushTextBuffer();

        if (!token.name) {
          throw new ParserError('Block start missing name', token.line);
        }

        const block = nodePool.getBlock(
          token.name,
          parseProperties(token.properties || '')
        );

        currentParent.content.push(block);
        stack.push(block);
        break;
      }

      case 'BLOCK_END': {
        flushTextBuffer();

        if (stack.length <= 1) {
          throw new ParserError('Unexpected block end with no open blocks', token.line);
        }
        stack.pop();
        break;
      }

      case 'DASH_ELEMENT': {
        flushTextBuffer();

        if (!token.name) {
          throw new ParserError('Dash element missing name', token.line);
        }

        const dashElement = nodePool.getDashElement(
          token.name,
          parseProperties(token.properties || ''),
          token.label
        );

        // Process content for this dash element
        let elementContent = '';
        let j = i + 1;
        while (j < tokens.length && tokens[j].type === 'TEXT') {
          elementContent += tokens[j].value;
          j++;
        }

        if (elementContent) {
          dashElement.content.push(nodePool.getText(elementContent));
        }

        currentParent.content.push(dashElement);
        i = j - 1;
        break;
      }

      case 'INLINE_CODE': {
        flushTextBuffer();

        currentParent.content.push({
          type: 'inline-code',
          content: token.value
        });
        break;
      }

      case 'INLINE_BLOCK': {
        flushTextBuffer();

        if (!token.name) {
          throw new ParserError('Inline block missing name', token.line);
        }

        // Create a new inline block node
        const inlineBlock = nodePool.getInlineBlock(
          token.name,
          parseProperties(token.properties || '')
        );

        // Add inline block to content
        currentParent.content.push(inlineBlock);
        break;
      }

      case 'DIVIDER': {
        flushTextBuffer();

        currentParent.content.push({
          type: 'divider'
        });
        break;
      }

      case 'TEXT': {
        if (!textBuffer) textLine = token.line;
        textBuffer += token.value;
        break;
      }
    }
  }

  // Flush any remaining text
  flushTextBuffer();

  // Handle unclosed code block
  if (inCodeBlock) {
    const currentParent = stack[stack.length - 1];
    currentParent.content.push({
      type: 'code-block',
      language: codeBlockLanguage || undefined,
      content: codeBlockContent
    });
  }

  // Check for unclosed blocks
  if (stack.length > 1) {
    const unclosedBlock = stack[stack.length - 1] as BlockNode;
    throw new ParserError(`Unclosed block: ${unclosedBlock.name}`,
      tokens[tokens.length - 1]?.line || 0);
  }

  return document;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Parse markdown and return the AST directly
 * With caching support for repeated inputs
 */
function parseMarkdown(input: string): DocumentNode | { error: string } {
  // Clear the cache to ensure fresh results for each parse
  ParseCache.clear();

  // Hash input for cache key
  const hashKey = Array.from(input)
    .reduce((hash, char) => ((hash << 5) - hash) + char.charCodeAt(0), 0)
    .toString(36);

  const cached = ParseCache.get(hashKey);
  if (cached) return cached;

  try {
    const result = parse(input);
    ParseCache.set(hashKey, result);
    return result;
  } catch (error) {
    const errorResult = error instanceof ParserError
      ? { error: error.message }
      : { error: `Parsing error: ${(error as Error).message}` };

    ParseCache.set(hashKey, errorResult);
    return errorResult;
  }
}

/**
 * Parse markdown and return the AST as JSON
 */
function parseMarkdownToJson(input: string): string {
  const result = parseMarkdown(input);
  return JSON.stringify(result, null, 2);
}

// Export all interfaces and functions
export {
  parse,
  parseMarkdown,
  parseMarkdownToJson,
  tokenize,
  parseProperties,
  ParserError
};

export type {
  Node,
  TextNode,
  CodeBlockNode,
  BlockNode,
  DashElementNode,
  DocumentNode,
  Property,
  InlineCodeNode,
  DividerNode,
  InlineBlockNode // Export the new node type
}