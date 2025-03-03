import type { BlockModifier, GinkoASTNode } from './types';

export class StepsModifier implements BlockModifier {
  canHandle(node: GinkoASTNode): boolean {
    if (node.type !== 'block') return false;
    return node.name === 'steps';
  }

  modifyBlock(node: GinkoASTNode): GinkoASTNode {
    if (node.type !== 'block' || node.name !== 'steps') return node;

    // Get step elements from content
    const content = Array.isArray(node.content) ? node.content : [];
    const stepElements = content.filter(
      (child: GinkoASTNode) => child.type === 'dash-element' && child.name === 'step'
    );

    // Transform each step dash-element into a ginko-step block
    const stepBlocks = stepElements.map((step: GinkoASTNode) => {
      if (step.type !== 'dash-element') return step;

      // Create properties array starting with any existing properties
      const properties = [...(step.properties || [])];

      // Add label property if it exists
      if (step.label) {
        properties.push({ name: 'label', value: step.label });
      }

      return {
        type: 'block',
        name: 'ginko-step',
        properties: properties,
        content: step.content || []
      };
    });

    // Return the ginko-steps block with transformed step blocks
    return {
      type: 'block',
      name: 'ginko-steps',
      properties: node.properties || [],
      content: stepBlocks
    };
  }
}
