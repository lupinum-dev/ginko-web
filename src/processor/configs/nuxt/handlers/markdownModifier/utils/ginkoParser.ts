/**
 * Advanced Custom Markdown Parser
 * 
 * Supports:
 * 1. Basic blocks: ::blockName ... ::
 * 2. Blocks with properties: ::blockName(prop="value" flag) ... ::
 * 3. Dash elements: --elementName Content
 * 4. Dash elements with properties: --elementName(prop="value") Content
 * 5. Nested blocks and elements
 * 6. Code blocks: Content inside ``` is treated as raw text
 * 
 * Returns structured JSON AST
 */

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

/** Union type for all node types */
type ASTNode = TextNode | CodeBlockNode | DashElementNode | BlockNode;

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
// Tokenizer
// ============================================================================

/** All possible token types */
type TokenType =
  | 'BLOCK_START'    // ::name(props)
  | 'BLOCK_END'      // ::
  | 'DASH_ELEMENT'   // --name(props)
  | 'CODE_BLOCK_START' // ```
  | 'CODE_BLOCK_END'   // ```
  | 'CODE_BLOCK_CONTENT' // Content inside code block
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

/**
 * Tokenize the input string into semantic tokens
 */
function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let position = 0;
  let insideCodeBlock = false;

  // Helper to calculate line number for error reporting
  const getLineNumber = (pos: number): number => {
    return input.slice(0, pos).split('\n').length;
  };

  // Process input until we reach the end
  while (position < input.length) {
    const currentLine = getLineNumber(position);
    const remaining = input.slice(position);

    // If we're inside a code block, look for its end
    if (insideCodeBlock) {
      const codeBlockEndPos = remaining.indexOf('```');

      if (codeBlockEndPos === -1) {
        // No end found, treat the rest as code content
        tokens.push({
          type: 'CODE_BLOCK_CONTENT',
          value: remaining,
          line: currentLine
        });
        position = input.length;
      } else {
        // Add the content before the end marker
        if (codeBlockEndPos > 0) {
          tokens.push({
            type: 'CODE_BLOCK_CONTENT',
            value: remaining.slice(0, codeBlockEndPos),
            line: currentLine
          });
        }

        // Add the end marker
        tokens.push({
          type: 'CODE_BLOCK_END',
          value: '```',
          line: getLineNumber(position + codeBlockEndPos)
        });

        position += codeBlockEndPos + 3; // Move past the end marker
        insideCodeBlock = false;
      }
      continue;
    }

    // Match code block start: ```language?
    const codeBlockMatch = remaining.match(/^```([^\n]*)\n/);
    if (codeBlockMatch) {
      tokens.push({
        type: 'CODE_BLOCK_START',
        value: codeBlockMatch[0],
        language: codeBlockMatch[1].trim(),
        line: currentLine
      });

      position += codeBlockMatch[0].length;
      insideCodeBlock = true;
      continue;
    }

    // Match block start: ::name(props)
    const blockStartMatch = remaining.match(/^::([a-zA-Z0-9_-]+)(?:\s*\(([^)]*)\))?\s*\n/);
    if (blockStartMatch) {
      tokens.push({
        type: 'BLOCK_START',
        value: blockStartMatch[0],
        name: blockStartMatch[1],
        properties: blockStartMatch[2]?.trim() || '',
        line: currentLine
      });

      position += blockStartMatch[0].length;
      continue;
    }

    // Match dash element: --name(props)
    const dashElementMatch = remaining.match(/^--([a-zA-Z][a-zA-Z0-9_-]*)(?:\s*\(([^)]*)\))?\s+(.*?)(?=\n|$)/);
    if (dashElementMatch) {
      const [fullMatch, name, props, remainingLine] = dashElementMatch;
      // Split the remaining line into label and content
      const label = remainingLine.trim();

      tokens.push({
        type: 'DASH_ELEMENT',
        value: fullMatch,
        name: name,
        properties: props?.trim() || '',
        label: label,
        line: currentLine
      });

      position += fullMatch.length;
      if (remaining[fullMatch.length] === '\n') {
        position += 1; // Skip the newline
      }
      continue;
    }

    // Match block end: ::
    const blockEndMatch = remaining.match(/^::\s*\n?/);
    if (blockEndMatch) {
      tokens.push({
        type: 'BLOCK_END',
        value: '::',
        line: currentLine
      });

      position += blockEndMatch[0].length;
      continue;
    }

    // Find the next token start
    const nextTokenPositions = [
      { type: 'BLOCK_START', pos: remaining.indexOf('::') },
      { type: 'DASH_ELEMENT', pos: remaining.indexOf('--') },
      { type: 'CODE_BLOCK', pos: remaining.indexOf('```') }
    ].filter(item => item.pos >= 0)
      .sort((a, b) => a.pos - b.pos);

    // No more tokens, everything else is text
    if (nextTokenPositions.length === 0) {
      tokens.push({
        type: 'TEXT',
        value: remaining,
        line: currentLine
      });
      break;
    }

    // Get the position of the next token
    const nextPos = nextTokenPositions[0].pos;

    // If there's text before the next token, add it as TEXT
    if (nextPos > 0) {
      tokens.push({
        type: 'TEXT',
        value: remaining.slice(0, nextPos),
        line: currentLine
      });
      position += nextPos;
    } else {
      // Check for valid token patterns at the current position
      const potentialToken = remaining.slice(0, 3);
      const isCodeBlock = potentialToken === '```';
      const isBlockToken = remaining.slice(0, 2) === '::';
      const isDashToken = remaining.slice(0, 2) === '--';

      if (isCodeBlock) {
        // This should be caught by the code block regex above
        // If we're here, it's not a proper code block start (no newline)
        tokens.push({
          type: 'TEXT',
          value: '```',
          line: currentLine
        });
        position += 3;
      } else if (isBlockToken && remaining.match(/^::[a-zA-Z0-9_-]/)) {
        // It's a malformed block token
        tokens.push({
          type: 'TEXT',
          value: '::',
          line: currentLine
        });
        position += 2;
      } else if (isDashToken && remaining.match(/^--[a-zA-Z0-9_-]/)) {
        // It's a malformed dash token
        tokens.push({
          type: 'TEXT',
          value: '--',
          line: currentLine
        });
        position += 2;
      } else {
        // Just a normal text character
        tokens.push({
          type: 'TEXT',
          value: remaining.slice(0, 1),
          line: currentLine
        });
        position += 1;
      }
    }
  }

  return tokens;
}

// ============================================================================
// Property Parser
// ============================================================================

/**
 * Parse properties string into structured Property objects
 */
function parseProperties(propString: string): Property[] {
  if (!propString) return [];

  const properties: Property[] = [];
  const propRegex = /([a-zA-Z0-9_-]+)(?:=(?:"([^"]*)"|(true|false|\d+)))?/g;

  let match: RegExpExecArray | null;
  while ((match = propRegex.exec(propString)) !== null) {
    const name = match[1];
    let value: string | boolean | number;

    // Determine property value type
    if (match[2] !== undefined) {
      // String value in quotes
      value = match[2];
    } else if (match[3] !== undefined) {
      // Boolean or number
      if (match[3] === 'true') value = true;
      else if (match[3] === 'false') value = false;
      else value = Number(match[3]);
    } else {
      // Flag without value (implicit true)
      value = true;
    }

    properties.push({ name, value });
  }

  return properties;
}

// ============================================================================
// Parser
// ============================================================================

/**
 * Parse tokens into an AST
 */
function parse(input: string): DocumentNode {
  const tokens = tokenize(input);
  const document: DocumentNode = { type: 'document', content: [] };

  // Stack to track nested blocks
  const stack: (BlockNode | DocumentNode)[] = [document];

  // Current text content buffer
  let textBuffer = '';

  // Code block tracking
  let codeBlockContent = '';
  let codeBlockLanguage = '';
  let inCodeBlock = false;

  // Helper to flush text buffer into current parent
  const flushTextBuffer = () => {
    if (textBuffer) {
      const currentParent = stack[stack.length - 1];
      currentParent.content.push({
        type: 'text',
        content: textBuffer
      });
      textBuffer = '';
    }
  };

  // Process all tokens
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const currentParent = stack[stack.length - 1];

    switch (token.type) {
      case 'CODE_BLOCK_START': {
        // Flush any pending text
        flushTextBuffer();

        // Start tracking code block content
        inCodeBlock = true;
        codeBlockContent = '';
        codeBlockLanguage = token.language || '';
        break;
      }

      case 'CODE_BLOCK_CONTENT': {
        if (inCodeBlock) {
          codeBlockContent += token.value;
        } else {
          // Shouldn't happen, but just in case
          textBuffer += token.value;
        }
        break;
      }

      case 'CODE_BLOCK_END': {
        if (inCodeBlock) {
          // Create code block node
          currentParent.content.push({
            type: 'code-block',
            language: codeBlockLanguage || undefined,
            content: codeBlockContent
          });

          // Reset code block tracking
          inCodeBlock = false;
          codeBlockContent = '';
          codeBlockLanguage = '';
        } else {
          // Treat as regular text
          textBuffer += token.value;
        }
        break;
      }

      case 'BLOCK_START': {
        // Flush any pending text
        flushTextBuffer();

        if (!token.name) {
          throw new ParserError('Block start missing name', token.line);
        }

        // Create new block node
        const block: BlockNode = {
          type: 'block',
          name: token.name,
          properties: parseProperties(token.properties || ''),
          content: []
        };

        // Add to parent and push to stack
        currentParent.content.push(block);
        stack.push(block);
        break;
      }

      case 'BLOCK_END': {
        // Flush any pending text
        flushTextBuffer();

        if (stack.length <= 1) {
          throw new ParserError('Unexpected block end with no open blocks', token.line);
        }
        stack.pop();
        break;
      }

      case 'DASH_ELEMENT': {
        // Flush any pending text
        flushTextBuffer();

        if (!token.name) {
          throw new ParserError('Dash element missing name', token.line);
        }

        // Create dash element node with its own content parsing
        const dashElement: DashElementNode = {
          type: 'dash-element',
          name: token.name,
          properties: parseProperties(token.properties || ''),
          content: [],
          label: token.label
        };

        // Find the content for this dash element (until next non-TEXT token)
        let elementContent = '';
        let j = i + 1;
        while (j < tokens.length &&
          (tokens[j].type === 'TEXT' ||
            (tokens[j].type === 'BLOCK_START' && j === i + 1 && tokens[j].value.trim() === ''))) {
          elementContent += tokens[j].value;
          j++;
        }

        // If there's content, parse it recursively
        if (elementContent.trim()) {
          // For simple text, just add it directly
          if (!elementContent.includes('::') && !elementContent.includes('--')) {
            dashElement.content.push({
              type: 'text',
              content: elementContent
            });
          } else {
            // For content with nested elements, parse it recursively
            const nestedDoc = parse(elementContent);
            dashElement.content = nestedDoc.content;
          }
        }

        // Add to parent
        currentParent.content.push(dashElement);

        // Skip tokens we've consumed
        i = j - 1;
        break;
      }

      case 'TEXT': {
        // Accumulate text in buffer
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
// Main Parser Function
// ============================================================================

/**
 * Parse markdown and return the AST as JSON
 */
function parseMarkdownToJson(input: string): string {
  try {
    const ast = parse(input);
    return JSON.stringify(ast, null, 2);
  } catch (error) {
    if (error instanceof ParserError) {
      return JSON.stringify({ error: error.message }, null, 2);
    }
    return JSON.stringify({ error: `Parsing error: ${(error as Error).message}` }, null, 2);
  }
}

/**
 * Parse markdown and return the AST directly
 */
function parseMarkdown(input: string): DocumentNode | { error: string } {
  try {
    return parse(input);
  } catch (error) {
    if (error instanceof ParserError) {
      return { error: error.message };
    }
    return { error: `Parsing error: ${(error as Error).message}` };
  }
}

// ============================================================================
// Test Cases
// ============================================================================

// Test Case 1: Basic Note with Title
const test1 = `::note
--title Two ways to write
We offer two ways two write your callouts, with Ginko Callouts as our recommended option.
::note
--title Inner
Inner Text
::
Outer
::`;

// Test Case 2: Layout with Columns
const test2 = `::layout
--col
First
--col
Second
--col
Third
::`;

// Test Case 3: Complex Nested Structure
const test3 = `::layout(type="outline-dashed")
--col(size="lg")
Content in column one
--col(size="sm")
::note
Content
::
::`;

// Test Case 4: Steps with Icons
const test4 = `::steps(level="h3")
--step(icon="server") Step 1
Content of Step 1
--step(icon="cif:at") Step 2
Content of Step 2`;

// Test Case 5: Code Blocks
const test5 = `Before code block

\`\`\`
::note(size="lol")
--title(test props="okay") Two ways to write
We offer two ways two write your callouts, with Ginko Callouts as our recommended option.
::note(test props="okay")
--title Inner
Inner Text
::
Outer
::
\`\`\`

After code block`;

// Test Case 6: Code Block with Language
const test6 = `\`\`\`typescript
// This is TypeScript code
function hello(name: string): string {
  return \`Hello, \${name}!\`;
}
\`\`\``;

// Run tests
function runTests() {
  console.log("Test 1: Note with Title");
  console.log(parseMarkdownToJson(test1));

  console.log("\nTest 2: Layout with Columns");
  console.log(parseMarkdownToJson(test2));

  console.log("\nTest 3: Complex Nested Structure");
  console.log(parseMarkdownToJson(test3));

  console.log("\nTest 4: Steps with Icons");
  console.log(parseMarkdownToJson(test4));

  console.log("\nTest 5: Code Blocks");
  console.log(parseMarkdownToJson(test5));

  console.log("\nTest 6: Code Blocks with Language");
  console.log(parseMarkdownToJson(test6));

  // Special test from the request
  const specialTest = `\`\`\`
::note(size="lol")
--title(test props="okay") Two ways to write
We offer two ways two write your callouts, with Ginko Callouts as our recommended option.
::note(test props="okay")
--title Inner
Inner Text
::
Outer
::
\`\`\`
aa`;

  console.log("\nSpecial Test: Code Block with Content After");
  console.log(parseMarkdownToJson(specialTest));
}

runTests();

// Export the necessary types and functions
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
  ASTNode,
  Token,
  TokenType
};