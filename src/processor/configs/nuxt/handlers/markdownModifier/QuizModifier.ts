import type { ContentModifier } from '../../markdownModifier'

interface QuizQuestion {
  type: string;
  question: {
    text: string;
    additionalChoices?: string[];
  };
  answers?: Array<{
    text: string;
    correct?: boolean;
    position?: number;
  }>;
  pairs?: Array<{
    id: number;
    image?: string;
    text: string;
    match: string;
  }>;
}

interface Quiz {
  questions: QuizQuestion[];
}

export class QuizModifier implements ContentModifier {
  private readonly QUIZ_REGEX = /^::quiz\n([\s\S]*?)^::/gm;
  private readonly CHOICE_REGEX = /^(?:\t)*--choice\n([\s\S]*?)(?=^(?:\t)*--|\n::$)/gm;
  private readonly FILL_REGEX = /^(?:\t)*--fill\n([\s\S]*?)(?=^(?:\t)*--|\n::$)/gm;
  private readonly FIND_REGEX = /^(?:\t)*--find\(options="([^"]+)"\)\n([\s\S]*?)(?=^(?:\t)*--|\n::$)/gm;
  private readonly PAIR_REGEX = /^(?:\t)*--pair\n([\s\S]*?)(?=^(?:\t)*--|\n::$)/gm;
  private readonly ORDER_REGEX = /^(?:\t)*--order\n([\s\S]*?)(?=^(?:\t)*--|\n::$)/gm;
  private readonly CHECKBOX_REGEX = /^(?:\t)*- \[([ x])\] (.*)$/;
  private readonly IMAGE_REGEX = /:ginko-image\{src="([^"]+)"[^}]*\}/;

  modify(content: string): string {
    return content.replace(this.QUIZ_REGEX, (match) => {
      const quiz = this.parseQuiz(match);
      // Create the ginko-quiz component with stringified questions
      return `:ginko-quiz{:questions='${JSON.stringify(quiz.questions)}'}`;
    });
  }

  private parseQuiz(content: string): Quiz {
    const quiz: Quiz = { questions: [] };

    // Parse choice questions
    content.match(this.CHOICE_REGEX)?.forEach(block => {
      const lines = block.split('\n').filter(line => line.trim() && !line.trim().startsWith('--choice'));
      const questionText = lines.find(line => !this.CHECKBOX_REGEX.test(line))?.trim() || '';
      const answers = lines
        .filter(line => this.CHECKBOX_REGEX.test(line))
        .map(line => {
          const match = line.match(this.CHECKBOX_REGEX);
          if (!match) return null;
          return {
            text: match[2].trim(),
            correct: match[1] === 'x'
          };
        })
        .filter((answer): answer is NonNullable<typeof answer> => answer !== null);

      quiz.questions.push({
        type: 'choice',
        question: { text: questionText },
        answers
      });
    });

    // Parse fill questions
    content.match(this.FILL_REGEX)?.forEach(block => {
      const text = block.replace(/^(?:\t)*--fill\n/, '').trim();
      quiz.questions.push({
        type: 'fill',
        question: { text }
      });
    });

    // Parse find questions
    content.match(this.FIND_REGEX)?.forEach(block => {
      console.log('Processing find block:', block);
      // Use [\s\S] instead of . with s flag for better compatibility
      const findMatch = block.match(/^(?:\t)*--find\(options="([^"]+)"\)\n([\s\S]*?)(?=^(?:\t)*--|\n::$|$)/);
      if (!findMatch) return;

      const [, options, text] = findMatch;
      console.log('Find options:', options);
      console.log('Find text:', text);

      quiz.questions.push({
        type: 'find',
        question: {
          text: text.trim(),
          additionalChoices: options.split('|').map(opt => opt.trim())
        }
      });
    });

    // Parse pair questions
    content.match(this.PAIR_REGEX)?.forEach((block, blockIndex) => {
      console.log(`\nProcessing pair block ${blockIndex + 1}:`);
      console.log('Raw block:', block);

      const lines = block.split('\n')
        .filter(line => line.trim() && !line.trim().startsWith('--pair'));
      console.log('Filtered lines:', lines);

      const pairs: Array<{ id: number; image?: string; text: string; match: string }> = [];
      let currentItem: { image?: string; text: string } | null = null;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();
        const indentLevel = line.search(/\S/); // Count spaces/tabs before content
        console.log(`\nProcessing line ${i + 1}:`, line);
        console.log('Indent level:', indentLevel);

        if (trimmedLine.startsWith('- ')) {
          const isMatchLine = indentLevel > 0;
          console.log('Is match line:', isMatchLine);

          if (isMatchLine && currentItem) {
            // This is a match for the current item
            const match = trimmedLine.substring(2).trim();
            console.log('Found match:', match);
            pairs.push({
              id: pairs.length + 1,
              text: currentItem.text,
              match,
              ...(currentItem.image ? { image: currentItem.image } : {})
            });
            currentItem = null;
          } else {
            // This is a new item
            const imageMatch = trimmedLine.match(this.IMAGE_REGEX);
            let text = trimmedLine.substring(2).trim();

            if (imageMatch) {
              // Remove the ginko-image syntax from the text
              text = text.replace(this.IMAGE_REGEX, '').trim();
              currentItem = {
                image: imageMatch[1],
                text: '' // Will be updated if there's a description on the next line
              };
            } else {
              currentItem = { text };
            }

            // Check next line for description
            if (i + 1 < lines.length) {
              const nextLine = lines[i + 1];
              const nextIndentLevel = nextLine.search(/\S/);
              if (nextIndentLevel === indentLevel + 2 && !nextLine.trim().startsWith('- ')) {
                currentItem.text = nextLine.trim();
                i++; // Skip the next line since we've processed it
              }
            }

            console.log('New current item:', currentItem);
          }
        }
      }

      console.log('\nFinal pairs for this block:', pairs);

      quiz.questions.push({
        type: 'pair',
        question: {
          text: pairs.some(p => p.image) ?
            'Match the images with their corresponding pairs:' :
            'Match the items with their corresponding pairs:'
        },
        pairs
      });
    });

    // Parse order questions
    content.match(this.ORDER_REGEX)?.forEach(block => {
      const lines = block.split('\n')
        .filter(line => line.trim() && !line.trim().startsWith('--order'))
        .map(line => line.replace(/^(?:\t)*- /, '').trim());

      quiz.questions.push({
        type: 'order',
        question: { text: 'Arrange the items in the correct order:' },
        answers: lines.map((text, index) => ({
          text,
          position: index + 1
        }))
      });
    });

    return quiz;
  }
}
