import { describe, it, expect } from 'vitest'
import { QuizModifier } from '../../../../../../src/processor/configs/nuxt/handlers/markdownModifier/QuizModifier'

describe('QuizModifier', () => {
  let quizModifier: QuizModifier

  beforeEach(() => {
    quizModifier = new QuizModifier()
  })

  describe('modify method', () => {
    it('should return the original content if no quiz is found', () => {
      const content = 'This is a regular markdown content with no quiz'
      const result = quizModifier.modify(content)
      expect(result).toBe(content)
    })

    it('should transform a select quiz into a ginko-quiz component', () => {
      const content = `::quiz
--select(difficulty="easy")
What is the capital of France?
- [ ] London
- [x] Paris
- [ ] Berlin
- [ ] Madrid
=> Great job! Paris is the capital of France.
=< Hint: It's known as the "City of Light".
::
`
      const result = quizModifier.modify(content)

      // Check that the result is a ginko-quiz component
      expect(result).toContain(':ginko-quiz')

      // Check that the JSON contains the correct question type
      expect(result).toContain('"type":"select"')

      // Check that the JSON contains the correct options
      expect(result).toContain('"text":"Paris"')
      expect(result).toContain('"correct":true')

      // Check that the JSON contains the correct feedback with HTML entities
      expect(result).toContain('"correct":"Great job! Paris is the capital of France."')
      expect(result).toContain('&quot;City of Light&quot;')
    })

    it('should transform a blank quiz into a ginko-quiz component', () => {
      const content = `::quiz
--blank(difficulty="medium")
The largest planet in our solar system is __________.
=> Correct! Jupiter is the largest planet in our solar system.
=< Hint: It's named after the king of the Roman gods.
::
`
      const result = quizModifier.modify(content)

      // Check that the result is a ginko-quiz component
      expect(result).toContain(':ginko-quiz')

      // Check that the JSON contains the correct question type
      expect(result).toContain('"type":"blank"')

      // Check that the JSON contains the correct question text
      expect(result).toContain('"question":"The largest planet in our solar system is __________."')

      // Check that the JSON contains the correct feedback with HTML entities
      expect(result).toContain('"correct":"Correct! Jupiter is the largest planet in our solar system."')
      expect(result).toContain('&apos;s named after the king of the Roman gods')
    })

    it('should transform a choose quiz into a ginko-quiz component', () => {
      const content = `::quiz
--choose(difficulty="hard", options="noun|verb|adjective|adverb")
In the sentence "The ++quick++ brown fox ++jumps++ over the lazy dog", identify the parts of speech for the highlighted words.
=> Correct! "Quick" is an adjective and "jumps" is a verb.
=< Hint: Adjectives describe nouns, and verbs show action.
::
`
      const result = quizModifier.modify(content)

      // Check that the result is a ginko-quiz component
      expect(result).toContain(':ginko-quiz')

      // Check that the JSON contains the correct question type
      expect(result).toContain('"type":"choose"')

      // Check that the JSON contains the options and highlighted terms
      expect(result).toContain('chooseOptions')
      expect(result).toContain('noun')
      expect(result).toContain('verb')
      expect(result).toContain('adjective')
      expect(result).toContain('adverb')
      expect(result).toContain('quick')
      expect(result).toContain('jumps')

      // Check that the JSON contains the highlighted terms
      expect(result).toContain('++quick++')
      expect(result).toContain('++jumps++')
    })

    it('should transform a sort quiz into a ginko-quiz component', () => {
      const content = `::quiz
--sort(difficulty="medium")
Arrange the following events in chronological order:
1. World War II
2. American Revolution
3. Fall of the Berlin Wall
4. Ancient Egyptian Civilization
=> Correct! The chronological order is: Ancient Egyptian Civilization, American Revolution, World War II, Fall of the Berlin Wall.
=< Hint: Consider which events happened in ancient times, 18th century, 20th century, and late 20th century.
::
`
      const result = quizModifier.modify(content)

      // Check that the result is a ginko-quiz component
      expect(result).toContain(':ginko-quiz')

      // Check that the JSON contains the correct question type
      expect(result).toContain('"type":"sort"')

      // Check that the JSON contains the correct items
      expect(result).toContain('"items":["World War II","American Revolution","Fall of the Berlin Wall","Ancient Egyptian Civilization"]')

      // Check that the JSON contains the correct positions
      expect(result).toContain('"position":1')
      expect(result).toContain('"position":2')
      expect(result).toContain('"position":3')
      expect(result).toContain('"position":4')
    })

    it('should transform a match quiz with table format into a ginko-quiz component', () => {
      const content = `::quiz
--match(difficulty="easy")
Match each country with its capital:
| Country | Capital |
| ------- | ------- |
| USA | Washington D.C. |
| Japan | Tokyo |
| France | Paris |
| Australia | Canberra |
=> Correct! You've matched all countries with their capitals.
=< Hint: Remember that some capitals are not the largest or most well-known cities.
::
`
      const result = quizModifier.modify(content)

      // Check that the result is a ginko-quiz component
      expect(result).toContain(':ginko-quiz')

      // Check that the JSON contains the correct question type
      expect(result).toContain('"type":"match"')

      // Check that the first row is used as the question
      expect(result).toContain('"question":"Country"')

      // Check that the JSON contains the correct pairs
      expect(result).toContain('"figure":"USA"')
      expect(result).toContain('"figure":"Washington D.C."')
      expect(result).toContain('"figure":"Japan"')
      expect(result).toContain('"figure":"Tokyo"')
    })

    it('should transform a match quiz with list format into a ginko-quiz component', () => {
      const content = `::quiz
--match(difficulty="medium")
Match each element with its chemical symbol:
- Oxygen
    - O
- Hydrogen
    - H
- Carbon
    - C
- Nitrogen
    - N
=> Correct! You've matched all elements with their symbols.
=< Hint: These are some of the most common elements in organic chemistry.
::
`
      const result = quizModifier.modify(content)

      // Check that the result is a ginko-quiz component
      expect(result).toContain(':ginko-quiz')

      // Check that the JSON contains the correct question type
      expect(result).toContain('"type":"match"')

      // Check that the JSON contains the correct question text
      expect(result).toContain('"question":"Match each element with its chemical symbol:"')

      // Check that the JSON contains the correct pairs
      expect(result).toContain('"figure":"Oxygen"')
      expect(result).toContain('"figure":"O"')
      expect(result).toContain('"figure":"Hydrogen"')
      expect(result).toContain('"figure":"H"')
    })

    it('should handle multiple quizzes in the same content', () => {
      const content = `# Quiz Section

::quiz
--select(difficulty="easy")
What is 2 + 2?
- [ ] 3
- [x] 4
- [ ] 5
- [ ] 6
=> Correct! 2 + 2 = 4
=< Hint: Count on your fingers.
::

Some text in between quizzes.

::quiz
--blank(difficulty="medium")
The capital of Italy is __________.
=> Correct! Rome is the capital of Italy.
=< Hint: It's home to the Colosseum.
::
`
      const result = quizModifier.modify(content)

      // Check that the result contains two ginko-quiz components
      const matches = result.match(/:ginko-quiz/g)
      expect(matches).toHaveLength(2)

      // Check that the first quiz is a select type
      expect(result).toContain('"type":"select"')

      // Check that the second quiz is a blank type
      expect(result).toContain('"type":"blank"')
    })

    it('should handle the ginko-callout format for quizzes', () => {
      const content = `::ginko-callout{type="quiz"}
--select(difficulty="easy")
What is the capital of Spain?
- [ ] Lisbon
- [x] Madrid
- [ ] Barcelona
- [ ] Valencia
=> Correct! Madrid is the capital of Spain.
=< Hint: It's located in the center of the country.
::
`
      const result = quizModifier.modify(content)

      // Check that the result is a ginko-quiz component
      expect(result).toContain(':ginko-quiz')

      // Check that the JSON contains the correct question type
      expect(result).toContain('"type":"select"')

      // Check that the JSON contains the correct options
      expect(result).toContain('"text":"Madrid"')
      expect(result).toContain('"correct":true')
    })
  })
}) 