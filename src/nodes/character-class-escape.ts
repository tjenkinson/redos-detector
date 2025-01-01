import {
  CharacterReader,
  characterReaderTypeCharacterEntry,
} from '../character-reader/character-reader-level-0';
import { invertRanges, OurRange } from '../our-range';
import { CharacterClassEscape } from 'regjsparser';

export type CharacterClassEscapeValue = 'd' | 'D' | 'w' | 'W' | 's' | 'S';

// [0-9]
const dRanges: readonly OurRange[] = [[48, 57]];
const inverseDRanges = invertRanges(dRanges);

// [A-Za-z0-9_]
const wRanges: readonly OurRange[] = [
  [48, 57],
  [65, 90],
  [95, 95],
  [97, 122],
];
const inverseWRanges = invertRanges(wRanges);

// [\f\n\r\t\v\u0020\u00a0\u1680\u2000-\u200a\u2028-\u2029\u202f\u205f\u3000\ufeff]
const sRanges: readonly OurRange[] = [
  [9, 9],
  [10, 10],
  [11, 11],
  [12, 12],
  [13, 13],
  [32, 32],
  [160, 160],
  [5760, 5760],
  [8192, 8202],
  [8232, 8233],
  [8239, 8239],
  [8287, 8287],
  [12288, 12288],
  [65279, 65279],
];
const inverseSRanges = invertRanges(sRanges);

export function characterClassEscapeToRange(
  value: CharacterClassEscapeValue,
): readonly OurRange[] {
  switch (value) {
    case 'd':
    case 'D': {
      return value === 'd' ? dRanges : inverseDRanges;
    }
    case 'w':
    case 'W': {
      return value === 'w' ? wRanges : inverseWRanges;
    }
    case 's':
    case 'S': {
      return value === 's' ? sRanges : inverseSRanges;
    }
  }
}

export function* buildCharacterClassEscapeReader(
  node: CharacterClassEscape,
): CharacterReader {
  const value = node.value as CharacterClassEscapeValue;
  const ranges = characterClassEscapeToRange(value);
  yield {
    characterGroups: {
      ranges,
      rangesNegated: false,
      unicodePropertyEscapes: new Map(),
    },
    node,
    stack: [],
    subType: 'groups',
    type: characterReaderTypeCharacterEntry,
  };
}
