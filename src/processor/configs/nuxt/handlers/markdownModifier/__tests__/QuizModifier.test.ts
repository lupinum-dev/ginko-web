import { describe, expect, it } from 'vitest'
import { QuizModifier } from '../QuizModifier'
import { MarkdownModifier } from '../MarkdownModifier'
import { parseMarkdown } from '../utils/ginkoParser'
import { astToMarkdown } from '../utils/astToMarkdown'
import type { GinkoAST } from '../types'

describe('QuizModifier', () => {
  it('should transform a quiz block with multiple question types', () => {
    const input = `::quiz
--select(difficulty="medium")
**Welche** Entdeckung machte *Heinrich Hertz* im Jahr 1886?
- [x] Die Radiowellen
- [x] Die elektromagnetischen Wellen
- [ ] Die Schallwellen
- [ ] Die Lichtwellen
=> Exzellent! Die Entdeckung der elektromagnetischen Wellen war fundamental für die Entwicklung der drahtlosen Kommunikation - ohne sie wären Radio, Fernsehen und moderne Mobilkommunikation nicht möglich.
=< Tipp: Hertz bewies experimentell die von Maxwell theoretisch vorhergesagten Wellen, die sich mit Lichtgeschwindigkeit ausbreiten und heute die Grundlage der drahtlosen Kommunikation bilden.
 
--blank(difficulty="medium")
Das **Erdmagnetfeld** in *Mitteleuropa* hat eine Flussdichte von ++48++ µT, mit ++20++ µT in der *horizontalen* und ++44++ µT in der *vertikalen* Richtung.
=> Perfekt! Diese Werte sind essentiell für das Verständnis der Induktionsexperimente - sie erklären, warum bestimmte Spulenausrichtungen stärkere Induktionsspannungen erzeugen.
=< Denk an die Angaben im Text: Das Erdmagnetfeld hat unterschiedliche Stärken in verschiedenen Richtungen, wobei die vertikale Komponente in Mitteleuropa stärker ist als die horizontale.
 
--choose(difficulty="medium" options="elektromagnetische Induktion | Radiowellen | elektrische Leitung | optische Telegrafie")
Das von Michael Faraday entdeckte Prinzip der ++elektromagnetische Induktion++ war grundlegend für die Entwicklung von Mikrofonen und anderen Wandlern in der Nachrichtentechnik.
=> Richtig! Die elektromagnetische Induktion ist das grundlegende Prinzip für die Umwandlung von mechanischer Bewegung in elektrische Signale, wie es in dynamischen Mikrofonen geschieht.
=< Überlege, welches physikalische Prinzip die Umwandlung von Schallwellen in elektrische Signale ermöglicht.
 
--sort(difficulty="medium")
Ordnen Sie diese **Entwicklungen** der *Nachrichtentechnik* chronologisch:
- Optische Telegrafie (Balkentelegraph von Chappe)
- Elektrische Telegrafie (Morse-Telegraph)
- Telefon (Bell)
- Drahtlose Telegrafie (Marconi)
=> Perfekt! Diese chronologische Entwicklung zeigt die Evolution der Kommunikationstechnologie - von visuellen Signalen über leitungsgebundene elektrische Systeme bis hin zur drahtlosen Kommunikation.
=< Tipp: Verfolge den technologischen Fortschritt - beginnend mit der optischen Zeichenübertragung bis zur Nutzung elektromagnetischer Wellen.
 
--match(difficulty="medium")
Ordnen Sie diese **frühen Kommunikationssysteme** ihren *technischen Prinzipien* zu:
- Optische Telegrafie
    - Sichtbare Signale über große Distanzen
- Kohärer
    - Erhöhte Leitfähigkeit durch elektromagnetische Wellen
- Dynamisches Mikrofon
    - Elektromagnetische Induktion durch Membranschwingungen
- Nipkow-Scheibe
    - Mechanische Zerlegung von Bildern in Punkte
=> Perfekt! Das Verständnis dieser technischen Prinzipien zeigt, wie unterschiedliche physikalische Effekte für die Kommunikation genutzt wurden - von einfachen optischen Signalen bis zu komplexen elektromagnetischen Phänomenen.
=< Betrachte die physikalischen Grundlagen jeder Technologie: Welcher Effekt ermöglichte die jeweilige Informationsübertragung?

--match(difficulty="medium")

| This is the question |         |
| -------------------- | ------- |
| Item 1               | Match 1 |
| Item 2               | Match 2 |
| Item 3               | Match 3 |

=> Answer Correct
=< Answer Hint
::`

    const ast = parseMarkdown(input)
    const markdownModifier = new MarkdownModifier([new QuizModifier()])
    const modifiedAst = markdownModifier.modify(ast)
    const output = astToMarkdown(modifiedAst as GinkoAST)

    // Check that the output contains the ginko-quiz component with the correct questions
    expect(output).toContain(':ginko-quiz{')
    expect(output).toContain(':questions=\'[{')

    // Check that the select question is included
    expect(output).toContain('"type":"select"')
    expect(output).toContain('"difficulty":"medium"')
    expect(output).toContain('"question":"**Welche** Entdeckung machte *Heinrich Hertz* im Jahr 1886?"')
    expect(output).toContain('"text":"Die Radiowellen","correct":true')

    // Check that the blank question is included
    expect(output).toContain('"type":"blank"')
    expect(output).toContain('"answers":[{"text":"48"},{"text":"20"},{"text":"44"}]')

    // Check that the choose question is included
    expect(output).toContain('"items":["elektromagnetische Induktion"]')
    expect(output).toContain('"chooseOptions":"elektromagnetische Induktion | Radiowellen | elektrische Leitung | optische Telegrafie"')

    // Check that the sort question is included
    expect(output).toContain('"items":["Optische Telegrafie (Balkentelegraph von Chappe)"')
    expect(output).toContain('"Elektrische Telegrafie (Morse-Telegraph)"')

    // Check that the match question (nested list format) is included
    expect(output).toContain('"pairs":[{')
    expect(output).toContain('"term":{"figure":"Optische Telegrafie"}')
    expect(output).toContain('"definition":{"figure":"Sichtbare Signale über große Distanzen"}')

    // Check that the table-format match question is included correctly
    expect(output).toContain('"question":"This is the question"')

    // Parse the output to check for duplicate items in table-format match question
    const questionsStartIndex = output.indexOf(':questions=\'') + 12;
    const questionsEndIndex = output.lastIndexOf('\'}');
    const questionsJson = output.substring(questionsStartIndex, questionsEndIndex);
    const questions = JSON.parse(questionsJson);

    // Find the table-format match question
    const tableMatchQuestion = questions.find(q =>
      q.type === 'match' && q.question === 'This is the question');

    // Check that there are no duplicate pairs
    expect(tableMatchQuestion).toBeDefined();
    expect(tableMatchQuestion.pairs).toBeDefined();

    // Count occurrences of each item
    const termCounts = {};
    tableMatchQuestion.pairs.forEach(pair => {
      const term = pair.term.figure;
      termCounts[term] = (termCounts[term] || 0) + 1;
    });

    // Check that each term appears exactly once
    Object.values(termCounts).forEach(count => {
      expect(count).toBe(1);
    });

    // Verify the correct number of pairs (3 items)
    expect(tableMatchQuestion.pairs.length).toBe(3);

    // Verify each specific item is present exactly once
    expect(tableMatchQuestion.pairs.filter(p => p.term.figure === 'Item 1').length).toBe(1);
    expect(tableMatchQuestion.pairs.filter(p => p.term.figure === 'Item 2').length).toBe(1);
    expect(tableMatchQuestion.pairs.filter(p => p.term.figure === 'Item 3').length).toBe(1);

    // Verify each match is correctly paired with its item
    const item1Pair = tableMatchQuestion.pairs.find(p => p.term.figure === 'Item 1');
    const item2Pair = tableMatchQuestion.pairs.find(p => p.term.figure === 'Item 2');
    const item3Pair = tableMatchQuestion.pairs.find(p => p.term.figure === 'Item 3');

    expect(item1Pair.definition.figure).toBe('Match 1');
    expect(item2Pair.definition.figure).toBe('Match 2');
    expect(item3Pair.definition.figure).toBe('Match 3');
  })
})