import type { ContentModifier } from '../../markdownModifier'

interface QuizQuestion {
  type: string;
  difficulty?: string;
  question: string;
  options?: Array<{
    text: string;
    correct: boolean;
  }>;
  feedback?: {
    correct: string;
    hint: string;
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
  }> | Array<{
    term: {
      src?: string;
      figure?: string;
    };
    definition: {
      src?: string;
      figure?: string;
    };
  }>;
  additionalChoices?: string[];
  items?: string[];
  chooseOptions?: string;
}

interface Quiz {
  questions: QuizQuestion[];
}

export class QuizModifier implements ContentModifier {
  private readonly QUIZ_REGEX = /^(?:::quiz|::ginko-callout\{type="quiz"\})\n([\s\S]*?)^::/gm;
  private readonly CHECKBOX_REGEX = /^(?:\t)*- \[([ x])\] (.*)$/;
  private readonly IMAGE_REGEX = /!\[.*?\]\((.*?)\)(?:<br>)?([^|]*)?/;
  private readonly HIGHLIGHT_REGEX = /\+\+([^+]+)\+\+/g;
  private readonly NUMBERED_ITEM_REGEX = /^(?:\t)*\d+\.\s+(.*)$/;
  private readonly BULLET_ITEM_REGEX = /^(?:\t)*-\s+(.*)$/;
  private readonly TABLE_ROW_REGEX = /^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|$/;

  modify(content: string): string {
    const modified = content.replace(this.QUIZ_REGEX, (match, capturedContent) => {

      try {
        const quiz = this.parseQuiz(match);
        // Create the ginko-quiz component with stringified questions
        // Use HTML entities for quotes in the JSON string
        const jsonString = JSON.stringify(quiz.questions)
          .replace(/'/g, "&apos;")
          .replace(/\\"/g, "&quot;");

        const result = `:ginko-quiz{:questions='${jsonString}'}`;
        return result;
      } catch (error) {
        console.error('🎯 Error processing quiz:', error);
        return match; // Return original content on error
      }
    });

    return modified;
  }

  private parseQuiz(content: string): Quiz {
    const quiz: Quiz = { questions: [] };

    // Split content into blocks by '--' prefix, keeping the '--' prefix
    const blocks = content.split(/(?=^--)/m).filter(block => block.trim());

    blocks.forEach((block, index) => {

      try {
        if (block.startsWith('--select')) {
          this.parseSelectBlock(block, quiz);
        } else if (block.startsWith('--blank')) {
          this.parseBlankBlock(block, quiz);
        } else if (block.startsWith('--choose')) {
          this.parseChooseBlock(block, quiz);
        } else if (block.startsWith('--sort')) {
          this.parseSortBlock(block, quiz);
        } else if (block.startsWith('--match')) {
          this.parseMatchBlock(block, quiz);
        } else {
        }
      } catch (error) {
        console.error('🎯 Error processing block:', error);
      }
    });

    return quiz;
  }

  private parseSelectBlock(block: string, quiz: Quiz): void {
    const difficultyMatch = block.match(/--select\(difficulty="([^"]+)"\)/);
    const difficulty = difficultyMatch ? difficultyMatch[1] : 'medium';

    const lines = block.split('\n')
      .filter(line => line.trim() && !line.trim().startsWith('--select'));

    let questionText = '';
    const options: Array<{ text: string; correct: boolean }> = [];
    let correctFeedback = '';
    let hintFeedback = '';

    for (const line of lines) {

      if (this.CHECKBOX_REGEX.test(line)) {
        const match = line.match(this.CHECKBOX_REGEX);
        if (match) {
          options.push({
            text: match[2].trim(),
            correct: match[1] === 'x'
          });
        }
      } else if (line.trim().startsWith('=>')) {
        correctFeedback = line.substring(2).trim();
      } else if (line.trim().startsWith('=<')) {
        hintFeedback = line.substring(2).trim();
      } else if (line.trim()) {
        questionText = line.trim();
      }
    }

    const question = {
      type: 'select',
      difficulty,
      question: questionText,
      options,
      feedback: {
        correct: correctFeedback,
        hint: hintFeedback
      }
    };

    quiz.questions.push(question);
  }

  private parseBlankBlock(block: string, quiz: Quiz): void {
    const difficultyMatch = block.match(/--blank\(difficulty="([^"]+)"\)/);
    const difficulty = difficultyMatch ? difficultyMatch[1] : 'medium';

    const lines = block.split('\n')
      .filter(line => line.trim() && !line.trim().startsWith('--blank'));

    let questionText = '';
    let correctFeedback = '';
    let hintFeedback = '';

    for (const line of lines) {

      if (line.trim().startsWith('=>')) {
        correctFeedback = line.substring(2).trim();
      } else if (line.trim().startsWith('=<')) {
        hintFeedback = line.substring(2).trim();
      } else if (line.trim()) {
        questionText = line.trim();
      }
    }

    const question = {
      type: 'blank',
      difficulty,
      question: questionText,
      feedback: {
        correct: correctFeedback,
        hint: hintFeedback
      }
    };

    quiz.questions.push(question);
  }

  private parseChooseBlock(block: string, quiz: Quiz): void {

    // Extract options from the block header
    const optionsMatch = block.match(/--choose\(.*?options="([^"]+)".*?\)/);
    if (!optionsMatch) {
      console.error('🎯 No options found in choose block');
      return;
    }

    let baseOptions = optionsMatch[1].split('|').map(opt => opt.trim());


    // Extract difficulty if present
    const difficultyMatch = block.match(/difficulty="([^"]+)"/);
    const difficulty = difficultyMatch ? difficultyMatch[1] : 'medium';

    // Remove the header line and any trailing ::
    const lines = block
      .replace(/^--choose\(.*?options="[^"]+"\)\n/, '') // Remove header
      .replace(/\n::$/, '') // Remove trailing ::
      .split('\n')
      .filter(line => line.trim());

    let questionText = '';
    let correctFeedback = '';
    let hintFeedback = '';
    const highlightedTerms: string[] = [];

    for (const line of lines) {

      if (line.trim().startsWith('=>')) {
        correctFeedback = line.substring(2).trim();
      } else if (line.trim().startsWith('=<')) {
        hintFeedback = line.substring(2).trim();
      } else if (line.trim()) {
        questionText = line.trim();

        // Extract highlighted terms from the question
        const matches = questionText.matchAll(this.HIGHLIGHT_REGEX);
        for (const match of matches) {
          highlightedTerms.push(match[1]);
        }
      }
    }


    // Add highlighted terms to options if they're not already included
    const allOptions = [...new Set([...baseOptions, ...highlightedTerms])];

    const question = {
      type: 'choose',
      difficulty,
      question: questionText,
      chooseOptions: allOptions.join(' | '),
      feedback: {
        correct: correctFeedback,
        hint: hintFeedback
      }
    };

    quiz.questions.push(question);
  }

  private parseSortBlock(block: string, quiz: Quiz): void {
    const difficultyMatch = block.match(/--sort\(difficulty="([^"]+)"\)/);
    const difficulty = difficultyMatch ? difficultyMatch[1] : 'medium';

    // Remove the header line and any trailing ::
    const lines = block
      .replace(/^--sort\(difficulty="[^"]+"\)\n/, '') // Remove header
      .replace(/\n::$/, '') // Remove trailing ::
      .split('\n')
      .filter(line => line.trim());

    let questionText = '';
    let correctFeedback = '';
    let hintFeedback = '';
    const items: string[] = [];

    for (const line of lines) {

      if (line.trim().startsWith('=>')) {
        correctFeedback = line.substring(2).trim();
      } else if (line.trim().startsWith('=<')) {
        hintFeedback = line.substring(2).trim();
      } else {
        const numberedMatch = line.match(this.NUMBERED_ITEM_REGEX);
        const bulletMatch = line.match(this.BULLET_ITEM_REGEX);

        if (numberedMatch || bulletMatch) {
          const itemText = (numberedMatch || bulletMatch)![1].trim();
          items.push(itemText);
        } else if (line.trim()) {
          questionText = line.trim();
        }
      }
    }

    const question = {
      type: 'sort',
      difficulty,
      question: questionText,
      items,
      feedback: {
        correct: correctFeedback,
        hint: hintFeedback
      }
    };


    quiz.questions.push(question);
  }

  private parseMatchBlock(block: string, quiz: Quiz): void {
    const difficultyMatch = block.match(/--match\(difficulty="([^"]+)"\)/);
    const difficulty = difficultyMatch ? difficultyMatch[1] : 'medium';

    // Remove the header line and any trailing ::
    const lines = block
      .replace(/^--match\(difficulty="[^"]+"\)\n/, '') // Remove header
      .replace(/\n::$/, '') // Remove trailing ::
      .split('\n')
      .filter(line => line.trim());

    let questionText = '';
    let correctFeedback = '';
    let hintFeedback = '';
    const pairs: Array<{
      term: { src?: string; figure?: string };
      definition: { src?: string; figure?: string };
    }> = [];
    let currentTerm: string | null = null;

    // Check if it's a table format by looking for | characters
    const isTableFormat = lines.some(line => line.trim().startsWith('|'));

    if (isTableFormat) {
      // Process table format
      let hasImages = false;
      let isFirstContentRow = true;  // Flag to track if we're on the first content row

      for (const line of lines) {
        if (line.trim().startsWith('=>')) {
          correctFeedback = line.substring(2).trim();
        } else if (line.trim().startsWith('=<')) {
          hintFeedback = line.substring(2).trim();
        } else if (line.match(this.TABLE_ROW_REGEX)) {
          const match = line.match(this.TABLE_ROW_REGEX);
          if (match) {
            const [, term, definition] = match;
            // Skip header separator row (contains dashes)
            if (!line.includes('---')) {
              if (isFirstContentRow) {
                // First content row contains the question
                questionText = term.trim();
                isFirstContentRow = false;
              } else {
                // All subsequent rows are term-definition pairs
                const termImageMatch = term.match(this.IMAGE_REGEX);
                const defImageMatch = definition.match(this.IMAGE_REGEX);

                if (termImageMatch || defImageMatch) {
                  hasImages = true;
                  pairs.push({
                    term: {
                      src: termImageMatch ? termImageMatch[1] : undefined,
                      figure: termImageMatch ? (termImageMatch[2] || '').trim() : term.trim()
                    },
                    definition: {
                      src: defImageMatch ? defImageMatch[1] : undefined,
                      figure: defImageMatch ? (defImageMatch[2] || '').trim() : definition.trim()
                    }
                  });
                } else {
                  pairs.push({
                    term: { figure: term.trim() },
                    definition: { figure: definition.trim() }
                  });
                }
              }
            }
          }
        }
      }

      // If we have images and no explicit question text, use a default
      if (hasImages && !questionText) {
        questionText = "Match these images with their *correct counterpart*:";
      }
    } else {
      // Process list format
      for (const line of lines) {
        if (line.trim().startsWith('=>')) {
          correctFeedback = line.substring(2).trim();
        } else if (line.trim().startsWith('=<')) {
          hintFeedback = line.substring(2).trim();
        } else if (!line.startsWith('-') && !line.startsWith(' ')) {
          questionText = line.trim();
        } else if (line.startsWith('- ')) {
          currentTerm = line.substring(2).trim();
        } else if (line.startsWith('    - ') && currentTerm) {
          const definition = line.substring(6).trim();
          pairs.push({
            term: { figure: currentTerm },
            definition: { figure: definition }
          });
          currentTerm = null;
        }
      }
    }

    const question = {
      type: 'match',
      difficulty,
      question: questionText,
      pairs,
      feedback: {
        correct: correctFeedback,
        hint: hintFeedback
      }
    };

    console.log('🎯 Pushing match question:', JSON.stringify(question, null, 2));
    quiz.questions.push(question);
  }
}
