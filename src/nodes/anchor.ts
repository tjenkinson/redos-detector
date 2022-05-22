import {
  CharacterReader,
  characterReaderTypeCharacterEntry,
} from '../character-reader/character-reader-level-0';
import { Anchor } from 'regjsparser';

export function* buildAnchorReader(node: Anchor): CharacterReader {
  switch (node.kind) {
    case 'end':
      {
        yield {
          offset: node.range[0],
          stack: [],
          subType: 'end',
          type: characterReaderTypeCharacterEntry,
        };
      }

      /* istanbul ignore next */
      throw new Error('Internal error: should not be reading after end');
    case 'start': {
      yield {
        offset: node.range[0],
        stack: [],
        subType: 'start',
        type: characterReaderTypeCharacterEntry,
      };
      break;
    }
    case 'boundary':
    case 'not-boundary': {
      break;
    }
  }
}
