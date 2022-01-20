import {
  CharacterReader,
  characterReaderTypeCharacterEntry,
} from '../character-reader/character-reader';

export function* buildEndReader(): CharacterReader {
  yield {
    groups: new Map(),
    lookaheadStack: [],
    node: null,
    quantifierStack: [],
    subType: 'end',
    type: characterReaderTypeCharacterEntry,
  };

  /* istanbul ignore next */
  throw new Error('Internal error: should not be reading after end');
}
