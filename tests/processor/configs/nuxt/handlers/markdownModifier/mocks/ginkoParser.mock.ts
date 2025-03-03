import type { GinkoAST } from '../../../../../../../src/processor/configs/nuxt/handlers/markdownModifier/types';

// Simple mock parser for testing
export function mockParseMarkdown(input: string): GinkoAST | { error: string } {
  // Handle basic callout
  if (input.includes('::note') && !input.includes('{')) {
    return {
      type: 'document',
      content: [
        { type: 'text', content: 'Above Callout\n' },
        {
          type: 'block',
          name: 'note',
          properties: [],
          content: [{ type: 'text', content: 'Inner\n' }]
        },
        { type: 'text', content: 'Below Callout' }
      ]
    };
  }

  // Handle callout with properties
  if (input.includes('::note') && input.includes('{size="lol"}')) {
    return {
      type: 'document',
      content: [
        {
          type: 'block',
          name: 'note',
          properties: [{ name: 'size', value: 'lol' }],
          content: [{ type: 'text', content: 'Inner\n' }]
        }
      ]
    };
  }

  // Handle collapsible callout
  if (input.includes('::info-')) {
    return {
      type: 'document',
      content: [
        {
          type: 'block',
          name: 'info-',
          properties: [],
          content: [{ type: 'text', content: 'Collapsible content\n' }]
        }
      ]
    };
  }

  // Handle callout with title
  if (input.includes('--title')) {
    return {
      type: 'document',
      content: [
        {
          type: 'block',
          name: 'info',
          properties: [],
          content: [
            {
              type: 'dash-element',
              name: 'title',
              properties: [],
              content: [],
              label: 'Custom Title for Your Callout'
            },
            { type: 'text', content: 'Here\'s a callout block with a title.\n' }
          ]
        }
      ]
    };
  }

  // Return error for invalid input
  return { error: 'Mock parser could not parse input' };
} 