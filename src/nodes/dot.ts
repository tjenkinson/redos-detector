import {
  CharacterReader,
  characterReaderTypeCharacterEntry,
} from '../character-reader/character-reader-level-0';
import { Dot } from 'regjsparser';

export function* buildDotCharacterReader({
  dotAll,
  node,
}: {
  dotAll: boolean;
  node: Dot;
}): CharacterReader {
  yield {
    characterGroups: {
      ranges: dotAll
        ? []
        : // [\n\r\u2028-\u2029]
          [
            [10, 10],
            [13, 13],
            [8232, 8233],
          ],
      rangesNegated: true,
      unicodePropertyEscapes: new Map(),
    },
    node,
    stack: [],
    subType: 'groups',
    type: characterReaderTypeCharacterEntry,
  };
}
