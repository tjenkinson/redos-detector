import {
  CharacterReader,
  characterReaderTypeCharacterEntry,
  CharacterReaderValueGroups,
} from '../character-reader/character-reader';
import { buildArrayReader } from '../reader';
import { CharacterClass } from 'regjsparser';
import { characterClassEscapeToRange } from './character-class-escape';
import { MutableCharacterGroups } from '../character-groups';

export function buildCharacterClassCharacterReader(
  node: CharacterClass
): CharacterReader {
  const characterGroups: MutableCharacterGroups = {
    characterClassEscapes: new Set(),
    dot: false,
    negated: !!node.negative,
    ranges: [],
    unicodePropertyEscapes: new Set(),
  };

  for (const expression of node.body) {
    switch (expression.type) {
      case 'value': {
        characterGroups.ranges.push([
          expression.codePoint,
          expression.codePoint,
        ]);
        break;
      }
      case 'characterClassRange': {
        const { min, max } = expression;
        characterGroups.ranges.push([min.codePoint, max.codePoint]);
        break;
      }
      case 'characterClassEscape': {
        const range = characterClassEscapeToRange(expression.value);
        if (range) {
          characterGroups.ranges.push(range);
        } else {
          characterGroups.characterClassEscapes.add(expression.value);
        }
        break;
      }
      case 'unicodePropertyEscape': {
        characterGroups.unicodePropertyEscapes.add(expression.value);
        break;
      }
    }
  }

  return buildArrayReader<CharacterReaderValueGroups>([
    {
      characterGroups,
      groups: new Map(),
      lookaheadStack: [],
      node,
      quantifierStack: [],
      subType: 'groups',
      type: characterReaderTypeCharacterEntry,
    },
  ]);
}
