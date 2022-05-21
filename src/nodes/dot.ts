import {
  CharacterReader,
  characterReaderTypeCharacterEntry,
} from '../character-reader/character-reader-level-0';
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
    node,
    stack: [],
    subType: 'groups',
    type: characterReaderTypeCharacterEntry,
  };
}
