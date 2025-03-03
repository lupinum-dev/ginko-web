import type { BlockModifier, GinkoASTNode } from './types';

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

export class QuizModifier implements BlockModifier {
  // Regular expressions for parsing different question types
  private readonly CHECKBOX_REGEX = /^(?:\t)*- \[([ x])\] (.*)$/;
  private readonly IMAGE_REGEX = /!\[.*?\]\((.*?)\)(?:<br>)?([^|]*)?/;
  private readonly HIGHLIGHT_REGEX = /\+\+([^+]+)\+\+/g;
  private readonly NUMBERED_ITEM_REGEX = /^(?:\t)*(\d+)\.\s+(.*)$/;
  private readonly BULLET_ITEM_REGEX = /^(?:\t)*-\s+(.*)$/;
  private readonly TABLE_ROW_REGEX = /^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|$/;
  private readonly NESTED_ITEM_REGEX = /^(?:\t)*-\s+(.*)\n(?:\t)*\s{4}-\s+(.*)$/;
  private readonly MATCH_PAIR_REGEX = /^(?:\t)*-\s+(.*)\n(?:\t)*\s{4}-\s+(.*)$/m;

  canHandle(node: GinkoASTNode): boolean {
    if (node.type !== 'block') return false;
    return node.name === 'quiz';
  }

  modifyBlock(node: GinkoASTNode): GinkoASTNode {
    if (node.type !== 'block' || node.name !== 'quiz') return node;

    // Get quiz elements from content
    const content = Array.isArray(node.content) ? node.content : [];

    // Parse quiz questions
    const quiz: Quiz = { questions: [] };

    // Process each dash-element as a question
    // Keep track of table elements that might be spread across multiple nodes
    let currentTableQuestion: GinkoASTNode | null = null;
    let tableContent = '';
    let feedbackLines: string[] = [];

    // First pass: Collect all dash-elements and identify table questions
    for (let i = 0; i < content.length; i++) {
      const element = content[i];

      if (element.type === 'dash-element') {
        // Check if this is a match question with a table format
        if (element.name === 'match' && element.label && element.label.startsWith('|')) {
          currentTableQuestion = element;
          tableContent = element.label + '\n';

          // Add any content already in the element
          if (Array.isArray(element.content)) {
            element.content.forEach(item => {
              if (item.type === 'text') {
                tableContent += item.content;
              }
            });
          }

          // Continue to next element without processing this one yet
          continue;
        } else {
          // If we were collecting a table but found a new dash-element, process the table
          if (currentTableQuestion) {
            // Create a modified version of the current table question with the collected content
            const modifiedTableQuestion = {
              ...currentTableQuestion,
              content: [{
                type: 'text',
                content: tableContent + feedbackLines.join('\n')
              }]
            };

            // Parse and add the table question
            this.parseQuestion(modifiedTableQuestion, quiz);

            // Reset table tracking
            currentTableQuestion = null;
            tableContent = '';
            feedbackLines = [];
          }

          // Process the current dash-element
          this.parseQuestion(element, quiz);
        }
      } else if (currentTableQuestion) {
        // If we're collecting a table, add this content
        if (element.type === 'text') {
          // Check if this is feedback
          const lines = element.content.split('\n');
          for (const line of lines) {
            if (line.startsWith('=>') || line.startsWith('=<')) {
              feedbackLines.push(line);
            } else if (line.trim() !== '') {
              tableContent += line + '\n';
            }
          }
        } else if (element.type === 'divider') {
          // Add divider character for tables
          tableContent += '----\n';
        }
      }
    }

    // Make sure to process any remaining table question
    if (currentTableQuestion) {
      const modifiedTableQuestion = {
        ...currentTableQuestion,
        content: [{
          type: 'text',
          content: tableContent + feedbackLines.join('\n')
        }]
      };

      this.parseQuestion(modifiedTableQuestion, quiz);
    }

    // Create a property with the stringified questions array
    const questionsJson = JSON.stringify(quiz.questions);

    // Return the ginko-quiz inline block with the questions as a property
    return {
      type: 'inline-block',
      name: 'ginko-quiz',
      properties: [
        { name: 'questions', value: questionsJson }
      ]
    };
  }

  private parseQuestion(element: GinkoASTNode, quiz: Quiz): void {
    if (element.type !== 'dash-element') return;

    const questionType = element.name;
    const difficulty = this.getPropertyValue(element.properties || [], 'difficulty');
    const questionText = element.label || '';

    // Get the content as string
    let contentText = '';
    if (Array.isArray(element.content)) {
      // First, check if there's a table in the content
      const hasTable = element.content.some(item =>
        item.type === 'table' ||
        (item.type === 'text' && item.content && item.content.includes('|'))
      );

      element.content.forEach(item => {
        if (item.type === 'text') {
          contentText += item.content;
        } else if (item.type === 'table') {
          // Handle table content
          const tableString = this.tableToString(item);
          contentText += tableString;
        }
      });
    }

    // Parse based on question type
    switch (questionType) {
      case 'select':
        this.parseSelectQuestion(contentText, questionText, difficulty, quiz);
        break;
      case 'blank':
        this.parseBlankQuestion(contentText, questionText, difficulty, quiz);
        break;
      case 'choose':
        this.parseChooseQuestion(contentText, questionText, difficulty, element.properties || [], quiz);
        break;
      case 'find':
        this.parseFindQuestion(contentText, questionText, difficulty, element.properties || [], quiz);
        break;
      case 'sort':
        this.parseSortQuestion(contentText, questionText, difficulty, quiz);
        break;
      case 'match':
        this.parseMatchQuestion(contentText, questionText, difficulty, quiz);
        break;
    }
  }

  private getPropertyValue(properties: Array<{ name: string; value: string | boolean }>, name: string): string | undefined {
    const property = properties.find(p => p.name === name);
    return property ? String(property.value) : undefined;
  }

  private extractHighlightedTerms(text: string): string[] {
    const terms: string[] = [];
    let match;
    const regex = new RegExp(this.HIGHLIGHT_REGEX);
    while ((match = regex.exec(text)) !== null) {
      terms.push(match[1]);
    }
    return terms;
  }

  private parseSelectQuestion(content: string, questionText: string, difficulty: string | undefined, quiz: Quiz): void {
    const lines = content.split('\n');
    const options: Array<{ text: string; correct: boolean }> = [];
    let correctFeedback = '';
    let hintFeedback = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Parse checkbox options
      const checkboxMatch = this.CHECKBOX_REGEX.exec(line);
      if (checkboxMatch) {
        options.push({
          text: checkboxMatch[2],
          correct: checkboxMatch[1] === 'x'
        });
        continue;
      }

      // Parse feedback
      if (line.startsWith('=>')) {
        correctFeedback = line.substring(3).trim();
        continue;
      }

      if (line.startsWith('=<')) {
        hintFeedback = line.substring(3).trim();
        continue;
      }
    }

    const question: QuizQuestion = {
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

  private parseBlankQuestion(content: string, questionText: string, difficulty: string | undefined, quiz: Quiz): void {
    const lines = content.split('\n');
    let correctFeedback = '';
    let hintFeedback = '';

    // Extract highlighted terms from the question text
    const highlightedTerms = this.extractHighlightedTerms(questionText);
    const answers = highlightedTerms.map(term => ({ text: term }));

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Parse feedback
      if (line.startsWith('=>')) {
        correctFeedback = line.substring(3).trim();
        continue;
      }

      if (line.startsWith('=<')) {
        hintFeedback = line.substring(3).trim();
        continue;
      }
    }

    const question: QuizQuestion = {
      type: 'blank',
      difficulty,
      question: questionText,
      answers,
      feedback: {
        correct: correctFeedback,
        hint: hintFeedback
      }
    };

    quiz.questions.push(question);
  }

  private parseChooseQuestion(content: string, questionText: string, difficulty: string | undefined, properties: Array<{ name: string; value: string | boolean }>, quiz: Quiz): void {
    const lines = content.split('\n');
    let correctFeedback = '';
    let hintFeedback = '';

    // Extract highlighted terms from the question text
    const highlightedTerms = this.extractHighlightedTerms(questionText);

    // Get options from properties
    const optionsString = this.getPropertyValue(properties, 'options') || '';
    const options = optionsString.split('|').map(opt => opt.trim());

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Parse feedback
      if (line.startsWith('=>')) {
        correctFeedback = line.substring(3).trim();
        continue;
      }

      if (line.startsWith('=<')) {
        hintFeedback = line.substring(3).trim();
        continue;
      }
    }

    const question: QuizQuestion = {
      type: 'choose',
      difficulty,
      question: questionText,
      items: highlightedTerms,
      additionalChoices: options.filter(opt => !highlightedTerms.includes(opt)),
      chooseOptions: optionsString,
      feedback: {
        correct: correctFeedback,
        hint: hintFeedback
      }
    };

    quiz.questions.push(question);
  }

  private parseFindQuestion(content: string, questionText: string, difficulty: string | undefined, properties: Array<{ name: string; value: string | boolean }>, quiz: Quiz): void {
    const lines = content.split('\n');
    let correctFeedback = '';
    let hintFeedback = '';

    // Extract highlighted terms from the question text
    const highlightedTerms = this.extractHighlightedTerms(questionText);

    // Get options from properties
    const optionsString = this.getPropertyValue(properties, 'options') || '';
    const options = optionsString.split('|').map(opt => opt.trim());

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Parse feedback
      if (line.startsWith('=>')) {
        correctFeedback = line.substring(3).trim();
        continue;
      }

      if (line.startsWith('=<')) {
        hintFeedback = line.substring(3).trim();
        continue;
      }
    }

    // For find questions, we'll use the same structure as choose
    const question: QuizQuestion = {
      type: 'choose',
      difficulty,
      question: questionText,
      items: highlightedTerms,
      additionalChoices: options.filter(opt => !highlightedTerms.includes(opt)),
      chooseOptions: optionsString,
      feedback: {
        correct: correctFeedback,
        hint: hintFeedback
      }
    };

    quiz.questions.push(question);
  }

  private parseSortQuestion(content: string, questionText: string, difficulty: string | undefined, quiz: Quiz): void {
    const lines = content.split('\n');
    const items: string[] = [];
    let correctFeedback = '';
    let hintFeedback = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Parse bullet items
      const bulletMatch = this.BULLET_ITEM_REGEX.exec(line);
      if (bulletMatch) {
        items.push(bulletMatch[1].trim());
        continue;
      }

      // Parse feedback
      if (line.startsWith('=>')) {
        correctFeedback = line.substring(3).trim();
        continue;
      }

      if (line.startsWith('=<')) {
        hintFeedback = line.substring(3).trim();
        continue;
      }
    }

    const question: QuizQuestion = {
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

  private parseMatchQuestion(content: string, questionText: string, difficulty: string | undefined, quiz: Quiz): void {
    const lines = content.split('\n');
    const pairs: Array<{
      term: { figure: string; src?: string };
      definition: { figure: string; src?: string };
    }> = [];
    let correctFeedback = '';
    let hintFeedback = '';
    let isTable = false;
    let tableStarted = false;
    let tableRows: string[] = [];

    // Used to track unique pairs to prevent duplicates
    const processedPairs = new Set<string>();

    // Check if the question is in table format
    const isTableFormat = questionText.trim().startsWith('|');

    // If it's a table format, extract the question text from the first row
    let finalQuestionText = questionText;
    if (isTableFormat) {
      const tableMatch = this.TABLE_ROW_REGEX.exec(questionText);
      if (tableMatch) {
        finalQuestionText = tableMatch[1].trim();
      }

      // Collect all table rows from content
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('|') && line.endsWith('|')) {
          tableRows.push(line);
        }
      }
    }

    // Process the content line by line
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Parse feedback
      if (line.startsWith('=>')) {
        correctFeedback = line.substring(3).trim();
        continue;
      }

      if (line.startsWith('=<')) {
        hintFeedback = line.substring(3).trim();
        continue;
      }

      // Check if this is a markdown table row
      if (line.startsWith('|') && line.endsWith('|')) {
        // If this is the first table row, it might be the header
        if (!tableStarted) {
          tableStarted = true;

          // Skip the header row and the separator row
          if (i + 1 < lines.length && lines[i + 1].trim().startsWith('|') && lines[i + 1].trim().includes('-')) {
            isTable = true;
            i += 1; // Skip the separator row
            continue;
          }
        }

        // If we're in a table, parse the row as a term-definition pair
        if (isTable || isTableFormat) {
          const tableMatch = this.TABLE_ROW_REGEX.exec(line);

          if (tableMatch) {
            const term = tableMatch[1].trim();
            const definition = tableMatch[2].trim();

            // Skip header or separator rows
            if (term.includes('---') || definition.includes('---')) {
              continue;
            }

            // Create a unique key for this pair to prevent duplicates
            const pairKey = `${term}:${definition}`;
            if (processedPairs.has(pairKey)) {
              continue; // Skip duplicate pairs
            }
            processedPairs.add(pairKey);

            // Check if term contains an image
            const termImageMatch = this.IMAGE_REGEX.exec(term);
            // Check if definition contains an image
            const defImageMatch = this.IMAGE_REGEX.exec(definition);

            const pair: any = {
              term: {},
              definition: {}
            };

            // Handle term (could be text or image)
            if (termImageMatch) {
              pair.term = {
                figure: term.replace(this.IMAGE_REGEX, '').trim() || termImageMatch[2] || '',
                src: termImageMatch[1]
              };
            } else {
              pair.term = {
                figure: term
              };
            }

            // Handle definition (could be text or image)
            if (defImageMatch) {
              pair.definition = {
                figure: definition.replace(this.IMAGE_REGEX, '').trim() || defImageMatch[2] || '',
                src: defImageMatch[1]
              };
            } else {
              pair.definition = {
                figure: definition
              };
            }

            pairs.push(pair);
          }
          continue;
        }
      } else if (line === '' || !line.startsWith('-')) {
        // Reset table state if we're no longer in a table
        tableStarted = false;
        isTable = false;
      }

      // If we're in table format but finished with regular table parsing, process any collected rows
      if (isTableFormat && tableRows.length > 0 && pairs.length === 0) {
        for (let j = 0; j < tableRows.length; j++) {
          const row = tableRows[j];
          const tableMatch = this.TABLE_ROW_REGEX.exec(row);

          if (tableMatch) {
            const term = tableMatch[1].trim();
            const definition = tableMatch[2].trim();

            // Skip header or separator rows
            if (term.includes('---') || definition.includes('---') ||
              term === finalQuestionText && definition === '') {
              continue;
            }

            // Create a unique key for this pair to prevent duplicates
            const pairKey = `${term}:${definition}`;
            if (processedPairs.has(pairKey)) {
              continue; // Skip duplicate pairs
            }
            processedPairs.add(pairKey);

            pairs.push({
              term: { figure: term },
              definition: { figure: definition }
            });
          }
        }
      }

      // Check if this is a term line (starts with a dash)
      if (line.startsWith('-') && !line.startsWith('- -')) {
        const term = line.substring(1).trim();

        // Check if the next line is a definition (indented dash)
        if (i + 1 < lines.length && lines[i + 1].trim().startsWith('-') && lines[i + 1].indexOf('-') > 2) {
          const definition = lines[i + 1].trim().substring(1).trim();

          // Check if term contains an image
          const termImageMatch = this.IMAGE_REGEX.exec(term);
          // Check if definition contains an image
          const defImageMatch = this.IMAGE_REGEX.exec(definition);

          const pair: any = {};

          // Handle term (could be text or image)
          if (termImageMatch) {
            pair.term = {
              figure: term.replace(this.IMAGE_REGEX, '').trim() || termImageMatch[2] || '',
              src: termImageMatch[1]
            };
          } else {
            pair.term = {
              figure: term
            };
          }

          // Handle definition (could be text or image)
          if (defImageMatch) {
            pair.definition = {
              figure: definition.replace(this.IMAGE_REGEX, '').trim() || defImageMatch[2] || '',
              src: defImageMatch[1]
            };
          } else {
            pair.definition = {
              figure: definition
            };
          }

          pairs.push(pair);
          i++; // Skip the definition line in the next iteration
        }
      }
    }

    const question: QuizQuestion = {
      type: 'match',
      difficulty,
      question: finalQuestionText,
      pairs,
      feedback: {
        correct: correctFeedback,
        hint: hintFeedback
      }
    };

    quiz.questions.push(question);
  }

  private tableToString(tableNode: GinkoASTNode): string {
    if (tableNode.type !== 'table' || !Array.isArray(tableNode.content)) {
      return '';
    }

    let tableString = '';

    // Process each row
    tableNode.content.forEach(row => {
      if (row.type === 'table-row' && Array.isArray(row.content)) {
        tableString += '|';

        // Process each cell
        row.content.forEach(cell => {
          if (cell.type === 'table-cell' && Array.isArray(cell.content)) {
            let cellContent = '';

            // Get cell content
            cell.content.forEach(item => {
              if (item.type === 'text') {
                cellContent += item.content;
              }
            });

            tableString += ` ${cellContent} |`;
          }
        });

        tableString += '\n';
      }
    });

    return tableString;
  }
}