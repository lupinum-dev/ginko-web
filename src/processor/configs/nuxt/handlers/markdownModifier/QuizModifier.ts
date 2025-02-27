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
  private readonly NUMBERED_ITEM_REGEX = /^(?:\t)*(\d+)\.\s+(.*)$/;
  private readonly BULLET_ITEM_REGEX = /^(?:\t)*-\s+(.*)$/;
  private readonly TABLE_ROW_REGEX = /^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|$/;

  modify(content: string): string {
    console.log('🎯 QuizModifier processing content');

    // First check if there are any quizzes in the content
    if (!this.QUIZ_REGEX.test(content)) {
      console.log('🎯 No quizzes found in content');
      return content;
    }

    // Reset the regex lastIndex to ensure it starts from the beginning
    this.QUIZ_REGEX.lastIndex = 0;

    const modified = content.replace(this.QUIZ_REGEX, (match, capturedContent) => {
      console.log('🎯 Found quiz match:', match.substring(0, 50) + '...');

      try {
        // Use the full match which includes the quiz markers
        const quiz = this.parseQuiz(match);

        // Create the ginko-quiz component with stringified questions
        // Use HTML entities for quotes in the JSON string
        const jsonString = JSON.stringify(quiz.questions)
          .replace(/'/g, "&apos;")
          .replace(/\\"/g, "&quot;");

        const result = `:ginko-quiz{:questions='${jsonString}'}`;
        console.log('🎯 Transformed quiz to component:', result.substring(0, 50) + '...');
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
    console.log('🎯 Parsing quiz content:', content);

    // Remove the quiz markers
    const cleanContent = content
      .replace(/^::quiz\n/, '')
      .replace(/^::ginko-callout\{type="quiz"\}\n/, '')
      .replace(/\n::$/, '');

    console.log('🎯 Cleaned quiz content:', cleanContent);

    // Split content into blocks by '--' prefix, keeping the '--' prefix
    const blocks = cleanContent.split(/(?=^--)/m).filter(block => block.trim());
    console.log('🎯 Found blocks:', blocks.length);

    blocks.forEach((block, index) => {
      console.log(`🎯 Processing block ${index + 1}:`, block.substring(0, 50) + '...');

      try {
        if (block.startsWith('--select')) {
          console.log('🎯 Identified as select block');
          this.parseSelectBlock(block, quiz);
        } else if (block.startsWith('--blank')) {
          console.log('🎯 Identified as blank block');
          this.parseBlankBlock(block, quiz);
        } else if (block.startsWith('--choose')) {
          console.log('🎯 Identified as choose block');
          this.parseChooseBlock(block, quiz);
        } else if (block.startsWith('--sort')) {
          console.log('🎯 Identified as sort block');
          this.parseSortBlock(block, quiz);
        } else if (block.startsWith('--match')) {
          console.log('🎯 Identified as match block');
          this.parseMatchBlock(block, quiz);
        } else {
          console.log('🎯 Unknown block type:', block.substring(0, 20));
        }
      } catch (error) {
        console.error('🎯 Error processing block:', error);
      }
    });

    console.log('🎯 Final quiz object:', JSON.stringify(quiz, null, 2));
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
    console.log('🎯 Processing sort block:', block);

    const difficultyMatch = block.match(/--sort\(difficulty="([^"]+)"\)/);
    const difficulty = difficultyMatch ? difficultyMatch[1] : 'medium';
    console.log('🎯 Difficulty:', difficulty);

    // Remove the header line and any trailing ::
    const lines = block
      .replace(/^--sort\(difficulty="[^"]+"\)\n/, '') // Remove header
      .replace(/\n::$/, '') // Remove trailing ::
      .split('\n')
      .filter(line => line.trim());

    console.log('🎯 Processed lines:', lines);

    let questionText = '';
    let correctFeedback = '';
    let hintFeedback = '';
    const items: string[] = [];
    const answers: Array<{ text: string; position: number }> = [];
    let currentPosition = 1;

    for (const line of lines) {
      console.log('🎯 Processing line:', line);

      if (line.trim().startsWith('=>')) {
        correctFeedback = line.substring(2).trim();
        console.log('🎯 Found correct feedback:', correctFeedback);
      } else if (line.trim().startsWith('=<')) {
        hintFeedback = line.substring(2).trim();
        console.log('🎯 Found hint feedback:', hintFeedback);
      } else {
        const numberedMatch = line.match(this.NUMBERED_ITEM_REGEX);
        const bulletMatch = line.match(this.BULLET_ITEM_REGEX);

        if (numberedMatch || bulletMatch) {
          const itemText = (numberedMatch) ? numberedMatch[2].trim() : bulletMatch![1].trim();
          items.push(itemText);
          console.log('🎯 Added item:', itemText);

          // If it's a numbered item, extract the position from the number
          if (numberedMatch) {
            const position = parseInt(numberedMatch[1], 10);
            console.log('🎯 Numbered item with position:', position);
            answers.push({
              text: itemText,
              position: position
            });
          } else if (bulletMatch) {
            // For bullet items, assign positions sequentially
            console.log('🎯 Bullet item with assigned position:', currentPosition);
            answers.push({
              text: itemText,
              position: currentPosition++
            });
          }
        } else if (line.trim()) {
          questionText = line.trim();
          console.log('🎯 Found question text:', questionText);
        }
      }
    }

    // Make sure we have answers for all items
    if (items.length > 0 && answers.length === 0) {
      console.log('🎯 No positions found, assigning default sequential positions');
      // If no positions were found, assign sequential positions
      items.forEach((item, index) => {
        answers.push({
          text: item,
          position: index + 1
        });
      });
    }

    console.log('🎯 Final items:', items);
    console.log('🎯 Final answers with positions:', answers);

    const question = {
      type: 'sort',
      difficulty,
      question: questionText,
      items,
      answers,
      feedback: {
        correct: correctFeedback,
        hint: hintFeedback
      }
    };

    console.log('🎯 Final sort question:', JSON.stringify(question, null, 2));
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

