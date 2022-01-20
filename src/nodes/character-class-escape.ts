import {
  CharacterReader,
  characterReaderTypeCharacterEntry,
} from '../character-reader/character-reader';
import { CharacterClassEscape } from 'regjsparser';
import { OurRange } from '../our-range';

export function characterClassEscapeToRange(value: string): OurRange | null {
  if (value === 'd') {
    // [0-9]
    return [48, 57];
  }
  return null;
}

export function* buildCharacterClassEscapeReader(
  node: CharacterClassEscape
): CharacterReader {
  const range = characterClassEscapeToRange(node.value);
  yield {
    characterGroups: {
      characterClassEscapes: new Set(range ? [] : [node.value]),
      dot: false,
      negated: false,
      ranges: range ? [range] : [],
      unicodePropertyEscapes: new Set(),
    },
    groups: new Map(),
    lookaheadStack: [],
    node,
    quantifierStack: [],
    subType: 'groups',
    type: characterReaderTypeCharacterEntry,
  };
}
