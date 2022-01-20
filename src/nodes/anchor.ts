import {
  CharacterReader,
  characterReaderTypeCharacterEntry,
} from '../character-reader/character-reader';
import { Anchor } from 'regjsparser';

export function* buildAnchorReader(node: Anchor): CharacterReader {
  switch (node.kind) {
    case 'end':
      {
        yield {
          groups: new Map(),
          lookaheadStack: [],
          node,
          quantifierStack: [],
          subType: 'end',
          type: characterReaderTypeCharacterEntry,
        };
      }

      /* istanbul ignore next */
      throw new Error('Internal error: should not be reading after end');
    case 'start': {
      yield {
        groups: new Map(),
        lookaheadStack: [],
        node,
        quantifierStack: [],
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
