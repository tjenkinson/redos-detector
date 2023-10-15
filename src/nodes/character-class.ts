import {
  characterClassEscapeToRange,
  CharacterClassEscapeValue,
} from './character-class-escape';
import {
  CharacterReader,
  characterReaderTypeCharacterEntry,
  CharacterReaderValueGroups,
} from '../character-reader/character-reader-level-0';
import { buildArrayReader } from '../reader';
import { buildCodePointRanges } from '../code-point';
import { CharacterClass } from 'regjsparser';
import { codePointFromValue } from './value';
import { MutableCharacterGroups } from '../character-groups';

export function buildCharacterClassCharacterReader({
  caseInsensitive,
  node,
}: {
  caseInsensitive: boolean;
  node: CharacterClass;
}): CharacterReader {
  const characterGroups: MutableCharacterGroups = {
    dot: false,
    negated: !!node.negative,
    ranges: [],
    unicodePropertyEscapes: new Set(),
  };

  for (const expression of node.body) {
    switch (expression.type) {
      case 'value': {
        const codePoint = codePointFromValue({
          caseInsensitive,
          value: expression,
        });
        characterGroups.ranges.push([codePoint, codePoint]);
        break;
      }
      case 'characterClassRange': {
        characterGroups.ranges.push(
          ...buildCodePointRanges({
            caseInsensitive,
            highCodePoint: expression.max.codePoint,
            lowCodePoint: expression.min.codePoint,
          }),
        );
        break;
      }
      case 'characterClassEscape': {
        const value = expression.value as CharacterClassEscapeValue;
        const ranges = characterClassEscapeToRange(value);
        characterGroups.ranges.push(...ranges);
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
      node,
      stack: [],
      subType: 'groups',
      type: characterReaderTypeCharacterEntry,
    },
  ]);
}
