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
import { OurRange } from '../our-range';

export function buildCharacterClassCharacterReader({
  caseInsensitive,
  node,
}: {
  caseInsensitive: boolean;
  node: CharacterClass;
}): CharacterReader {
  const ranges: OurRange[] = [];
  const unicodePropertyEscapes: Map<string, boolean> = new Map();
  let matchesEverything = false;

  outer: for (const expression of node.body) {
    switch (expression.type) {
      case 'value': {
        const codePoint = codePointFromValue({
          caseInsensitive,
          value: expression,
        });
        ranges.push([codePoint, codePoint]);
        break;
      }
      case 'characterClassRange': {
        ranges.push(
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
        ranges.push(...characterClassEscapeToRange(value));
        break;
      }
      case 'unicodePropertyEscape': {
        const resolvedNegative = expression.negative !== node.negative;
        if (
          unicodePropertyEscapes.get(expression.value) === !resolvedNegative
        ) {
          matchesEverything = true;
          break outer;
        }

        unicodePropertyEscapes.set(expression.value, resolvedNegative);
        break;
      }
    }
  }

  return buildArrayReader<CharacterReaderValueGroups>([
    {
      characterGroups: matchesEverything
        ? { ranges: [], rangesNegated: true, unicodePropertyEscapes: new Map() }
        : {
            ranges,
            rangesNegated: node.negative,
            unicodePropertyEscapes,
          },
      node,
      stack: [],
      subType: 'groups',
      type: characterReaderTypeCharacterEntry,
    },
  ]);
}
