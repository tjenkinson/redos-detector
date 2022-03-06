import {
  CharacterReader,
  characterReaderTypeCharacterEntry,
} from '../character-reader/character-reader';

export function* buildEndReader(offset: number): CharacterReader {
  yield {
    groups: new Map(),
    lookaheadStack: [],
    offset,
    quantifierStack: [],
    subType: 'end',
    type: characterReaderTypeCharacterEntry,
  };

  /* istanbul ignore next */
  throw new Error('Internal error: should not be reading after end');
}
