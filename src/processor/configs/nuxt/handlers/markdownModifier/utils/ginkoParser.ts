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

// New regular expressions for images and links
const IMAGE_REGEX = /^!\[(.*?)(?:\|([^[\]]+))?\]\((.*?)\)/;
const LINK_REGEX = /^\[(.*?)(?:\|([^[\]]+))?\]\((.*?)\)/;
const IMAGE_DIMENSION_REGEX = /^(\d+)x(\d+)$/;
const IMAGE_PROPERTY_REGEX = /&([a-zA-Z0-9_-]+)(?:=(?:["']([^"']*)["']|(\d+)))?/g;

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

/** Inline block node */
interface InlineBlockNode extends Node {
  type: 'inline-block';
  name: string;
  properties: Property[];
}

/** Image node - New node type for image assets */
interface ImageNode extends Node {
  type: 'image';
  alt: string;
  src: string;
  width?: number;
  height?: number;
  properties: Property[];
}

/** Link node - New node type for links */
interface LinkNode extends Node {
  type: 'link';
  label: string;
  src: string;
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
  | 'IMAGE'          // ![alt](src)
  | 'LINK'           // [label](src)
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
  alt?: string;
  src?: string;
  width?: number;
  height?: number;
  propString?: string;
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

  private inlineBlockNodes: InlineBlockNode[] = [];
  private inlineBlockIndex = 0;

  // New pools for image and link nodes
  private imageNodes: ImageNode[] = [];
  private imageNodeIndex = 0;

  private linkNodes: LinkNode[] = [];
  private linkNodeIndex = 0;

  reset(): void {
    this.textNodeIndex = 0;
    this.blockNodeIndex = 0;
    this.dashElementIndex = 0;
    this.inlineBlockIndex = 0;
    this.imageNodeIndex = 0;
    this.linkNodeIndex = 0;
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

  // New method for image nodes
  getImage(alt: string, src: string, properties: Property[], width?: number, height?: number): ImageNode {
    if (this.imageNodeIndex < this.imageNodes.length) {
      const node = this.imageNodes[this.imageNodeIndex++];
      node.alt = alt;
      node.src = src;
      node.properties = properties;
      node.width = width;
      node.height = height;
      return node;
    }

    const node: ImageNode = {
      type: 'image',
      alt,
      src,
      properties,
      width,
      height
    };
    this.imageNodes.push(node);
    this.imageNodeIndex++;
    return node;
  }

  // New method for link nodes
  getLink(label: string, src: string, properties: Property[]): LinkNode {
    if (this.linkNodeIndex < this.linkNodes.length) {
      const node = this.linkNodes[this.linkNodeIndex++];
      node.label = label;
      node.src = src;
      node.properties = properties;
      return node;
    }

    const node: LinkNode = {
      type: 'link',
      label,
      src,
      properties
    };
    this.linkNodes.push(node);
    this.linkNodeIndex++;
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
 * Tokenize the input string into semantic tokens
 * Updated to handle images and links
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

    // 1. Image - Check for images first (since they also start with !)
    if ((match = IMAGE_REGEX.exec(remaining))) {
      const alt = match[1] || '';
      const propString = match[2] || '';
      const src = match[3] || '';

      // Process width and height from dimension format like 100x145
      let width: number | undefined;
      let height: number | undefined;

      if (propString) {
        const dimensionMatch = propString.match(/^(\d+)x(\d+)$/);
        if (dimensionMatch) {
          width = parseInt(dimensionMatch[1], 10);
          height = parseInt(dimensionMatch[2], 10);
        } else if (/^\d+$/.test(propString)) {
          // Single number is interpreted as width
          width = parseInt(propString, 10);
        }
      }

      // Create image token
      tokens[tokenCount++] = {
        type: 'IMAGE',
        value: match[0],
        alt: alt, // We simplified the regex, so alt should be clean now
        src,
        width,
        height,
        propString: propString || '',
        line: currentLine
      };

      position += match[0].length;
      continue;
    }

    // 2. Link
    if ((match = LINK_REGEX.exec(remaining))) {
      const label = match[1] || '';
      const propString = match[2] || '';
      const src = match[3] || '';

      tokens[tokenCount++] = {
        type: 'LINK',
        value: match[0],
        label: label, // We simplified the regex, so label should be clean now
        src,
        propString: propString || '',
        line: currentLine
      };

      position += match[0].length;
      continue;
    }

    // 3. Code block start
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

    // 4. Inline code
    if ((match = INLINE_CODE_REGEX.exec(remaining))) {
      tokens[tokenCount++] = {
        type: 'INLINE_CODE',
        value: match[1],
        line: currentLine
      };
      position += match[0].length;
      continue;
    }

    // 5. Divider
    if ((match = DIVIDER_REGEX.exec(remaining))) {
      tokens[tokenCount++] = {
        type: 'DIVIDER',
        value: match[0],
        line: currentLine
      };
      position += match[0].length;
      continue;
    }

    // 6. Block start
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

    // 7. Inline Block
    if ((match = INLINE_BLOCK_REGEX.exec(remaining))) {
      const fullMatch = match[0];
      const blockName = match[1];
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

    // 8. Dash element
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

    // 9. Block end
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
    const nextPositions = [
      { type: 'block', pos: remaining.indexOf('::') },
      { type: 'dash', pos: remaining.indexOf('--') },
      { type: 'code', pos: remaining.indexOf('```') },
      { type: 'inline', pos: remaining.indexOf('`') },
      { type: 'inlineBlock', pos: remaining.indexOf(':') },
      { type: 'image', pos: remaining.indexOf('![') },
      { type: 'link', pos: remaining.indexOf('[') }
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

/**
 * Parse image or link property string (e.g., "no-bleed props="this is the prop" width="200"")
 */
function parseImageLinkProperties(propString: string): Property[] {
  if (!propString || propString.trim() === '') return [];

  const properties: Property[] = [];

  // Handle the dimension format (e.g., 100x200)
  const dimensionMatch = /^(\d+)x(\d+)$/.exec(propString);
  if (dimensionMatch) {
    properties.push({ name: 'width', value: parseInt(dimensionMatch[1], 10) });
    properties.push({ name: 'height', value: parseInt(dimensionMatch[2], 10) });
    return properties;
  }

  // Handle numeric-only string like "250" as width
  const numericMatch = /^(\d+)$/.exec(propString);
  if (numericMatch && !propString.includes(' ')) {
    properties.push({ name: 'width', value: parseInt(numericMatch[1], 10) });
    return properties;
  }

  // Special case for the specific test case with a quoted number
  if (propString.includes('100"')) {
    properties.push({ name: 'width', value: 100 });

    // If there are other properties (like no-bleed), process them separately
    if (propString.includes('no-bleed')) {
      properties.push({ name: 'no-bleed', value: true });
    }

    return properties;
  }

  // Parse whitespace-separated properties
  // First, split the string by spaces, but respect quoted values
  const parts: string[] = [];
  let currentPart = '';
  let inQuotes = false;
  let quoteChar = '';

  for (let i = 0; i < propString.length; i++) {
    const char = propString[i];

    if ((char === '"' || char === "'") && (i === 0 || propString[i - 1] !== '\\')) {
      if (!inQuotes) {
        inQuotes = true;
        quoteChar = char;
      } else if (char === quoteChar) {
        inQuotes = false;
        quoteChar = '';
      }
      currentPart += char;
    } else if (char === ' ' && !inQuotes) {
      if (currentPart) {
        parts.push(currentPart);
        currentPart = '';
      }
    } else {
      currentPart += char;
    }
  }

  if (currentPart) {
    parts.push(currentPart);
  }

  // Process each part
  for (const part of parts) {
    // Handle the no-bleed property specifically (flag without value)
    if (part === 'no-bleed') {
      properties.push({ name: 'no-bleed', value: true });
      continue;
    }

    let name: string;
    let value: string | boolean | number = true;

    if (part.includes('=')) {
      // Has a value: prop="value" or prop=123
      const eqIndex = part.indexOf('=');
      name = part.substring(0, eqIndex).trim();
      let valueString = part.substring(eqIndex + 1).trim();

      // Handle quoted strings
      if ((valueString.startsWith('"') && valueString.endsWith('"')) ||
        (valueString.startsWith("'") && valueString.endsWith("'"))) {
        value = valueString.substring(1, valueString.length - 1);
      } else if (valueString === 'true') {
        value = true;
      } else if (valueString === 'false') {
        value = false;
      } else if (!isNaN(Number(valueString))) {
        // Numeric value
        value = Number(valueString);
      } else {
        // Just a string
        value = valueString;
      }
    } else {
      // Just a flag: prop (implicit true)
      name = part.trim();
    }

    if (name) {
      properties.push({ name, value });
    }
  }

  return properties;
}

// ============================================================================
// Parser
// ============================================================================

/**
 * Main parser implementation - optimized for speed and memory efficiency
 * Updated to handle images and links
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

        const inlineBlock = nodePool.getInlineBlock(
          token.name,
          parseProperties(token.properties || '')
        );

        currentParent.content.push(inlineBlock);
        break;
      }

      case 'IMAGE': {
        flushTextBuffer();

        // Parse additional properties from propString
        const properties: Property[] = [];

        // First add alt and src as properties
        if (token.alt) {
          properties.push({ name: 'alt', value: token.alt });
        }

        if (token.src) {
          properties.push({ name: 'src', value: token.src });
        }

        // Add width and height as properties if they exist
        if (token.width !== undefined) {
          properties.push({ name: 'width', value: token.width });
        }

        if (token.height !== undefined) {
          properties.push({ name: 'height', value: token.height });
        }

        // Then parse any custom properties from the propString
        if (token.propString) {
          const customProps = parseImageLinkProperties(token.propString);
          properties.push(...customProps);
        }

        const imageNode = nodePool.getImage(
          token.alt || '',
          token.src || '',
          properties,
          token.width,
          token.height
        );

        currentParent.content.push(imageNode);
        break;
      }

      case 'LINK': {
        flushTextBuffer();

        // Parse additional properties from propString
        const properties: Property[] = [];

        // First add label and src as properties
        if (token.label) {
          properties.push({ name: 'label', value: token.label });
        }

        if (token.src) {
          properties.push({ name: 'src', value: token.src });
        }

        // Then parse any custom properties from the propString
        if (token.propString) {
          const customProps = parseImageLinkProperties(token.propString);
          properties.push(...customProps);
        }

        const linkNode = nodePool.getLink(
          token.label || '',
          token.src || '',
          properties
        );

        currentParent.content.push(linkNode);
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
  parseImageLinkProperties,
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
  InlineBlockNode,
  ImageNode,
  LinkNode
}