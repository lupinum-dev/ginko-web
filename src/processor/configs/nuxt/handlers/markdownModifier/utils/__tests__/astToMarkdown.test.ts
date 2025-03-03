import { describe, it, expect } from 'vitest';
import { astToMarkdown } from '../astToMarkdown';
import type { GinkoAST } from '../../types';

describe('astToMarkdown', () => {
  it('should render simple blocks with double colons', () => {
    const ast: GinkoAST = {
      type: 'document',
      content: [
        {
          type: 'block',
          name: 'ginko-center',
          properties: [],
          content: [
            {
              type: 'text',
              content: 'Center content'
            }
          ]
        }
      ]
    };

    const result = astToMarkdown(ast);
    expect(result).toBe('::ginko-center\nCenter content\n::\n');
  });

  it('should increase colons on opening tag with nesting level', () => {
    const ast: GinkoAST = {
      type: 'document',
      content: [
        {
          type: 'block',
          name: 'ginko-layout',
          properties: [],
          content: [
            {
              type: 'block',
              name: 'ginko-column',
              properties: [],
              content: [
                {
                  type: 'text',
                  content: 'First'
                }
              ]
            },
            {
              type: 'block',
              name: 'ginko-column',
              properties: [],
              content: [
                {
                  type: 'text',
                  content: 'Second'
                }
              ]
            }
          ]
        }
      ]
    };

    const result = astToMarkdown(ast);

    const expected = ':::ginko-layout\n::ginko-column\nFirst\n::\n::ginko-column\nSecond\n::\n:::\n';
    expect(result).toBe(expected);
  });

  it('should handle blocks nested two levels deep', () => {
    const ast: GinkoAST = {
      type: 'document',
      content: [
        {
          type: 'block',
          name: 'ginko-callout',
          properties: [
            { name: 'type', value: 'note' }
          ],
          content: [
            {
              type: 'block',
              name: 'ginko-layout',
              properties: [],
              content: [
                {
                  type: 'block',
                  name: 'ginko-column',
                  properties: [],
                  content: [
                    {
                      type: 'text',
                      content: 'First'
                    }
                  ]
                },
                {
                  type: 'block',
                  name: 'ginko-column',
                  properties: [],
                  content: [
                    {
                      type: 'text',
                      content: 'Second'
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    };

    const result = astToMarkdown(ast);

    const expected = '::::ginko-callout{type="note"}\n:::ginko-layout\n::ginko-column\nFirst\n::\n::ginko-column\nSecond\n::\n:::\n::::\n';
    expect(result).toBe(expected);
  });

  it('should handle the full complex example with correct nesting format', () => {
    // Create the AST that mirrors the example
    const ast: GinkoAST = {
      type: 'document',
      content: [
        {
          type: 'text',
          content: 'Above\n'
        },
        {
          type: 'block',
          name: 'ginko-layout',
          properties: [],
          content: [
            {
              type: 'block',
              name: 'ginko-column',
              properties: [],
              content: [
                {
                  type: 'text',
                  content: 'First'
                }
              ]
            },
            {
              type: 'block',
              name: 'ginko-column',
              properties: [],
              content: [
                {
                  type: 'text',
                  content: 'Second'
                }
              ]
            }
          ]
        },
        {
          type: 'divider'
        },
        {
          type: 'block',
          name: 'ginko-center',
          properties: [],
          content: [
            {
              type: 'text',
              content: 'First'
            }
          ]
        },
        {
          type: 'text',
          content: 'Below\n'
        },
        {
          type: 'block',
          name: 'ginko-callout',
          properties: [
            { name: 'type', value: 'note' }
          ],
          content: [
            {
              type: 'block',
              name: 'ginko-layout',
              properties: [],
              content: [
                {
                  type: 'block',
                  name: 'ginko-column',
                  properties: [],
                  content: [
                    {
                      type: 'text',
                      content: 'First'
                    }
                  ]
                },
                {
                  type: 'block',
                  name: 'ginko-column',
                  properties: [],
                  content: [
                    {
                      type: 'text',
                      content: 'Second'
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    };

    const result = astToMarkdown(ast);

    // Expected format with correct nesting
    const expected = `Above
:::ginko-layout
::ginko-column
First
::
::ginko-column
Second
::
:::
---
::ginko-center
First
::
Below
::::ginko-callout{type="note"}
:::ginko-layout
::ginko-column
First
::
::ginko-column
Second
::
:::
::::
`;

    expect(result).toBe(expected);
  });
});