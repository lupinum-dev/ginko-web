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
  private readonly SELECT_REGEX = /^(?:\t)*--select\(difficulty="([^"]+)"\)\n([\s\S]*?)(?=^(?:\t)*--|\n::$)/gm;
  private readonly BLANK_REGEX = /^(?:\t)*--blank\(difficulty="([^"]+)"\)\n([\s\S]*?)(?=^(?:\t)*--|\n::$)/gm;
  private readonly CHOOSE_REGEX = /^(?:\t)*--choose\((?:difficulty="[^"]+"\s*)?(?:options="([^"]+)")\)\n([\s\S]*?)(?=^(?:\t)*--|\n::$)/gm;
  private readonly SORT_REGEX = /^(?:\t)*--sort\(difficulty="([^"]+)"\)\n([\s\S]*?)(?=^(?:\t)*--|\n::$)/gm;
  private readonly CHOICE_REGEX = /^(?:\t)*--choice\n([\s\S]*?)(?=^(?:\t)*--|\n::$)/gm;
  private readonly FILL_REGEX = /^(?:\t)*--fill\n([\s\S]*?)(?=^(?:\t)*--|\n::$)/gm;
  private readonly FIND_REGEX = /^(?:\t)*--find\(options="([^"]+)"\)\n([\s\S]*?)(?=^(?:\t)*--|\n::$)/gm;
  private readonly PAIR_REGEX = /^(?:\t)*--pair\n([\s\S]*?)(?=^(?:\t)*--|\n::$)/gm;
  private readonly ORDER_REGEX = /^(?:\t)*--order\n([\s\S]*?)(?=^(?:\t)*--|\n::$)/gm;
  private readonly CHECKBOX_REGEX = /^(?:\t)*- \[([ x])\] (.*)$/;
  private readonly IMAGE_REGEX = /!\[.*?\]\((.*?)\)(?:<br>)?([^|]*)?/;
  private readonly FEEDBACK_REGEX = /^(?:\t)*=([<>]) (.*)$/;
  private readonly HIGHLIGHT_REGEX = /\+\+([^+]+)\+\+/g;
  private readonly NUMBERED_ITEM_REGEX = /^(?:\t)*\d+\.\s+(.*)$/;
  private readonly BULLET_ITEM_REGEX = /^(?:\t)*-\s+(.*)$/;
  private readonly MATCH_REGEX = /^(?:\t)*--match\(difficulty="([^"]+)"\)\n([\s\S]*?)(?=^(?:\t)*--|\n::$)/gm;
  private readonly TABLE_ROW_REGEX = /^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|$/;

  modify(content: string): string {
    console.log('🎯 Starting quiz modification');
    console.log('🎯 Input content:', content);
    console.log('🎯 QUIZ_REGEX pattern:', this.QUIZ_REGEX.source);

    const modified = content.replace(this.QUIZ_REGEX, (match, capturedContent) => {
      console.log('🎯 Found quiz block. Match length:', match.length);
      console.log('🎯 Quiz block content:', match);

      try {
        console.log('🎯 Attempting to parse quiz');
        const quiz = this.parseQuiz(match);
        console.log('🎯 Successfully parsed quiz:', JSON.stringify(quiz, null, 2));

        // Create the ginko-quiz component with stringified questions
        // Use HTML entities for quotes in the JSON string
        const jsonString = JSON.stringify(quiz.questions)
          .replace(/'/g, "&apos;")
          .replace(/\\"/g, "&quot;");

        console.log('🎯 Processed JSON string:', jsonString);
        const result = `:ginko-quiz{:questions='${jsonString}'}`;
        console.log('🎯 Final component:', result);
        return result;
      } catch (error) {
        console.error('🎯 Error processing quiz:', error);
        return match; // Return original content on error
      }
    });

    if (modified === content) {
      console.log('🎯 No quiz blocks found or no modifications made');
    } else {
      console.log('🎯 Successfully modified content');
    }

    return modified;
  }

  private parseQuiz(content: string): Quiz {
    console.log('\n🎯 Starting to parse quiz content');
    console.log('🎯 Content length:', content.length);
    console.log('🎯 Content to parse:', content);

    const quiz: Quiz = { questions: [] };

    // Split content into blocks by '--' prefix, keeping the '--' prefix
    const blocks = content.split(/(?=^--)/m).filter(block => block.trim());
    console.log('🎯 Found blocks:', blocks.length);

    blocks.forEach((block, index) => {
      console.log(`\n🎯 Processing block ${index + 1} of ${blocks.length}`);
      console.log('🎯 Block content:', block);

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
        } else if (block.startsWith('--choice')) {
          this.parseChoiceBlock(block, quiz);
        } else if (block.startsWith('--fill')) {
          this.parseFillBlock(block, quiz);
        } else if (block.startsWith('--find')) {
          this.parseFindBlock(block, quiz);
        } else if (block.startsWith('--pair')) {
          this.parsePairBlock(block, quiz);
        } else if (block.startsWith('--order')) {
          this.parseOrderBlock(block, quiz);
        } else {
          console.log('🎯 Skipping unknown block type');
        }
      } catch (error) {
        console.error('🎯 Error processing block:', error);
      }
    });

    console.log('\n🎯 Final quiz object:', JSON.stringify(quiz, null, 2));
    return quiz;
  }

  private parseSelectBlock(block: string, quiz: Quiz): void {
    console.log('🎯 Parsing select block');
    const difficultyMatch = block.match(/--select\(difficulty="([^"]+)"\)/);
    const difficulty = difficultyMatch ? difficultyMatch[1] : 'medium';
    console.log('🎯 Extracted difficulty:', difficulty);

    const lines = block.split('\n')
      .filter(line => line.trim() && !line.trim().startsWith('--select'));
    console.log('🎯 Filtered lines:', lines);

    let questionText = '';
    const options: Array<{ text: string; correct: boolean }> = [];
    let correctFeedback = '';
    let hintFeedback = '';

    for (const line of lines) {
      console.log('🎯 Processing line:', line);

      if (this.CHECKBOX_REGEX.test(line)) {
        const match = line.match(this.CHECKBOX_REGEX);
        if (match) {
          console.log('🎯 Found checkbox option:', match[2], 'correct:', match[1] === 'x');
          options.push({
            text: match[2].trim(),
            correct: match[1] === 'x'
          });
        }
      } else if (line.trim().startsWith('=>')) {
        correctFeedback = line.substring(2).trim();
        console.log('🎯 Found correct feedback:', correctFeedback);
      } else if (line.trim().startsWith('=<')) {
        hintFeedback = line.substring(2).trim();
        console.log('🎯 Found hint feedback:', hintFeedback);
      } else if (line.trim()) {
        questionText = line.trim();
        console.log('🎯 Found question text:', questionText);
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

    console.log('🎯 Pushing select question:', JSON.stringify(question, null, 2));
    quiz.questions.push(question);
  }

  private parseBlankBlock(block: string, quiz: Quiz): void {
    console.log('🎯 Parsing blank block');
    const difficultyMatch = block.match(/--blank\(difficulty="([^"]+)"\)/);
    const difficulty = difficultyMatch ? difficultyMatch[1] : 'medium';
    console.log('🎯 Extracted difficulty:', difficulty);

    const lines = block.split('\n')
      .filter(line => line.trim() && !line.trim().startsWith('--blank'));
    console.log('🎯 Filtered lines:', lines);

    let questionText = '';
    let correctFeedback = '';
    let hintFeedback = '';

    for (const line of lines) {
      console.log('🎯 Processing line:', line);

      if (line.trim().startsWith('=>')) {
        correctFeedback = line.substring(2).trim();
        console.log('🎯 Found correct feedback:', correctFeedback);
      } else if (line.trim().startsWith('=<')) {
        hintFeedback = line.substring(2).trim();
        console.log('🎯 Found hint feedback:', hintFeedback);
      } else if (line.trim()) {
        questionText = line.trim();
        console.log('🎯 Found question text:', questionText);
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

    console.log('🎯 Pushing blank question:', JSON.stringify(question, null, 2));
    quiz.questions.push(question);
  }

  private parseChooseBlock(block: string, quiz: Quiz): void {
    console.log('🎯 Parsing choose block');

    // Extract options from the block header
    const optionsMatch = block.match(/--choose\(.*?options="([^"]+)".*?\)/);
    if (!optionsMatch) {
      console.error('🎯 No options found in choose block');
      return;
    }

    let baseOptions = optionsMatch[1].split('|').map(opt => opt.trim());
    console.log('🎯 Base options:', baseOptions);

    // Extract difficulty if present
    const difficultyMatch = block.match(/difficulty="([^"]+)"/);
    const difficulty = difficultyMatch ? difficultyMatch[1] : 'medium';
    console.log('🎯 Extracted difficulty:', difficulty);

    // Remove the header line and any trailing ::
    const lines = block
      .replace(/^--choose\(.*?options="[^"]+"\)\n/, '') // Remove header
      .replace(/\n::$/, '') // Remove trailing ::
      .split('\n')
      .filter(line => line.trim());
    console.log('🎯 Filtered lines:', lines);

    let questionText = '';
    let correctFeedback = '';
    let hintFeedback = '';
    const highlightedTerms: string[] = [];

    for (const line of lines) {
      console.log('🎯 Processing line:', line);

      if (line.trim().startsWith('=>')) {
        correctFeedback = line.substring(2).trim();
        console.log('🎯 Found correct feedback:', correctFeedback);
      } else if (line.trim().startsWith('=<')) {
        hintFeedback = line.substring(2).trim();
        console.log('🎯 Found hint feedback:', hintFeedback);
      } else if (line.trim()) {
        questionText = line.trim();
        console.log('🎯 Found question text:', questionText);

        // Extract highlighted terms from the question
        const matches = questionText.matchAll(this.HIGHLIGHT_REGEX);
        for (const match of matches) {
          highlightedTerms.push(match[1]);
        }
      }
    }

    console.log('🎯 Found highlighted terms:', highlightedTerms);

    // Add highlighted terms to options if they're not already included
    const allOptions = [...new Set([...baseOptions, ...highlightedTerms])];
    console.log('🎯 Final options list:', allOptions);

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

    console.log('🎯 Pushing choose question:', JSON.stringify(question, null, 2));
    quiz.questions.push(question);
  }

  private parseSortBlock(block: string, quiz: Quiz): void {
    console.log('🎯 Parsing sort block');
    const difficultyMatch = block.match(/--sort\(difficulty="([^"]+)"\)/);
    const difficulty = difficultyMatch ? difficultyMatch[1] : 'medium';
    console.log('🎯 Extracted difficulty:', difficulty);

    // Remove the header line and any trailing ::
    const lines = block
      .replace(/^--sort\(difficulty="[^"]+"\)\n/, '') // Remove header
      .replace(/\n::$/, '') // Remove trailing ::
      .split('\n')
      .filter(line => line.trim());
    console.log('🎯 Filtered lines:', lines);

    let questionText = '';
    let correctFeedback = '';
    let hintFeedback = '';
    const items: string[] = [];

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
          const itemText = (numberedMatch || bulletMatch)![1].trim();
          console.log('🎯 Found item:', itemText);
          items.push(itemText);
        } else if (line.trim()) {
          questionText = line.trim();
          console.log('🎯 Found question text:', questionText);
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

    console.log('🎯 Pushing sort question:', JSON.stringify(question, null, 2));
    quiz.questions.push(question);
  }

  private parseChoiceBlock(block: string, quiz: Quiz): void {
    console.log('🎯 Parsing choice block');
    const lines = block.split('\n')
      .filter(line => line.trim() && !line.trim().startsWith('--choice'));

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
      question: questionText,
      answers
    });
  }

  private parseFillBlock(block: string, quiz: Quiz): void {
    console.log('🎯 Parsing fill block');
    const text = block.replace(/^(?:\t)*--fill\n/, '').trim();
    quiz.questions.push({
      type: 'fill',
      question: text
    });
  }

  private parseFindBlock(block: string, quiz: Quiz): void {
    console.log('🎯 Parsing find block');
    const findMatch = block.match(/^(?:\t)*--find\(options="([^"]+)"\)\n([\s\S]*?)(?=^(?:\t)*--|\n::$|$)/);
    if (!findMatch) return;

    const [, options, text] = findMatch;
    quiz.questions.push({
      type: 'find',
      question: text.trim(),
      additionalChoices: options.split('|').map(opt => opt.trim())
    });
  }

  private parsePairBlock(block: string, quiz: Quiz): void {
    console.log('🎯 Parsing pair block');
    const lines = block.split('\n')
      .filter(line => line.trim() && !line.trim().startsWith('--pair'));
    console.log('🎯 Filtered lines:', lines);

    const pairs: Array<{ id: number; image?: string; text: string; match: string }> = [];
    let currentItem: { image?: string; text: string } | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      const indentLevel = line.search(/\S/);
      console.log(`\nProcessing line ${i + 1}:`, line);
      console.log('Indent level:', indentLevel);

      if (trimmedLine.startsWith('- ')) {
        const isMatchLine = indentLevel > 0;
        console.log('Is match line:', isMatchLine);

        if (isMatchLine && currentItem) {
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
          const imageMatch = trimmedLine.match(this.IMAGE_REGEX);
          let text = trimmedLine.substring(2).trim();

          if (imageMatch) {
            text = text.replace(this.IMAGE_REGEX, '').trim();
            currentItem = {
              image: imageMatch[1],
              text: ''
            };
          } else {
            currentItem = { text };
          }

          if (i + 1 < lines.length) {
            const nextLine = lines[i + 1];
            const nextIndentLevel = nextLine.search(/\S/);
            if (nextIndentLevel === indentLevel + 2 && !nextLine.trim().startsWith('- ')) {
              currentItem.text = nextLine.trim();
              i++;
            }
          }

          console.log('New current item:', currentItem);
        }
      }
    }

    console.log('\nFinal pairs for this block:', pairs);

    quiz.questions.push({
      type: 'pair',
      question: pairs.some(p => p.image) ?
        'Match the images with their corresponding pairs:' :
        'Match the items with their corresponding pairs:',
      pairs
    });
  }

  private parseOrderBlock(block: string, quiz: Quiz): void {
    console.log('🎯 Parsing order block');
    const lines = block.split('\n')
      .filter(line => line.trim() && !line.trim().startsWith('--order'))
      .map(line => line.replace(/^(?:\t)*- /, '').trim());

    quiz.questions.push({
      type: 'order',
      question: 'Arrange the items in the correct order:',
      answers: lines.map((text, index) => ({
        text,
        position: index + 1
      }))
    });
  }

  private parseMatchBlock(block: string, quiz: Quiz): void {
    console.log('🎯 Parsing match block');
    const difficultyMatch = block.match(/--match\(difficulty="([^"]+)"\)/);
    const difficulty = difficultyMatch ? difficultyMatch[1] : 'medium';
    console.log('🎯 Extracted difficulty:', difficulty);

    // Remove the header line and any trailing ::
    const lines = block
      .replace(/^--match\(difficulty="[^"]+"\)\n/, '') // Remove header
      .replace(/\n::$/, '') // Remove trailing ::
      .split('\n')
      .filter(line => line.trim());
    console.log('🎯 Filtered lines:', lines);

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
    console.log('🎯 Format type:', isTableFormat ? 'table' : 'list');

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
