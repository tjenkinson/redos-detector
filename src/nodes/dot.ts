import {
  CharacterReader,
  characterReaderTypeCharacterEntry,
} from '../character-reader/character-reader';
import { Dot } from 'regjsparser';

export function* buildDotCharacterReader(node: Dot): CharacterReader {
  yield {
    characterGroups: {
      characterClassEscapes: new Set(),
      dot: true,
      negated: false,
      ranges: [],
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
