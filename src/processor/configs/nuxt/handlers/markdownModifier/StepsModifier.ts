import { ContentModifier } from '../../markdownModifier';

/**
 * Converts steps sections into structured step components
 * Handles both h2 and h3 level steps based on the type parameter
 */
export class StepsModifier implements ContentModifier {
	private addNoBleedToGinkoImage(content: string): string {
		return content.replace(
			/(:ginko-image{[^}]*?)}/g,
			(match, group) => {
				return group.includes('nobleed') ? match : `${group} nobleed}`;
			}
		);
	}

	private parseStepContent(content: string, headingLevel: string): string {
		const lines = content.split('\n');
		let steps: string[] = [];
		let currentStep = '';
		let isInStep = false;
		let isTitleSection = false;

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			
			// Skip empty lines at the beginning
			if (!isInStep && !line.trim()) continue;

			// Check if this is a title section (## heading)
			if (!isTitleSection && line.match(/^##\s/)) {
				isTitleSection = true;
				continue;
			}

			// Process step headings (### level)
			if (line.startsWith('###')) {
				if (currentStep) {
					steps.push(currentStep.trim());
				}
				currentStep = line + '\n';
				isInStep = true;
			} else if (isInStep) {
				currentStep += line + '\n';
			}
		}

		// Add the last step if exists
		if (currentStep) {
			steps.push(currentStep.trim());
		}

		// Format each step with ginko-step component and process ginko-images
		return steps
			.map(step => {
				const processedStep = this.addNoBleedToGinkoImage(step);
				return `::ginko-step\n${processedStep}\n::`;
			})
			.join('\n');
	}

	private detectTypeAndTitle(content: string): { type: string; title: string } {
		const lines = content.split('\n');
		const firstHeadingLine = lines.find(line => line.match(/^##[^#]/)); // Only match ## exactly
		
		if (!firstHeadingLine) {
			return { type: 'h3', title: '' };
		}

		// Only if we find an exact ## heading, use it as title and type h2
		return {
			type: 'h2',
			title: firstHeadingLine.replace(/^##\s*/, '').trim()
		};
	}

	modify(content: string, frontmatter: Record<string, any>): string {
		return content.replace(
			/\+\+steps(?:{([^}]+)})?\s*([\s\S]*?)\+\+/g,
			(match, attributes, stepsContent) => {
				// Parse existing attributes if any
				const attrMap = new Map<string, string>();
				if (attributes) {
					attributes.split(/\s+/).forEach((attr: string) => {
						const [key, value] = attr.split('=');
						if (key && value) {
							attrMap.set(
								key,
								value.replace(/["']/g, '') // Remove quotes
							);
						}
					});
				}

				// Detect type and title from content if not provided in attributes
				const { type: detectedType, title: detectedTitle } = this.detectTypeAndTitle(stepsContent);
				const type = attrMap.get('type') || detectedType;

				// Only include title in attributes if it exists
				const title = attrMap.get('title') || detectedTitle;
				const attributeString = title 
					? `{ type="${type}" title="${title}"}`
					: `{ type="${type}"}`;

				// Determine heading level based on type
				const headingLevel = type === 'h2' ? '###' : '####';

				// Format the steps content
				const formattedContent = this.parseStepContent(stepsContent, headingLevel);

				return `::ginko-steps${attributeString}\n\n${formattedContent}\n\n::`;
			}
		);
	}
}
