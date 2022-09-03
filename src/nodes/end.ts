import {
  CharacterReader,
  characterReaderTypeCharacterEntry,
} from '../character-reader/character-reader-level-0';

export function* buildEndReader(offset: number): CharacterReader {
  yield {
    bounded: false,
    offset,
    stack: [],
    subType: 'end',
    type: characterReaderTypeCharacterEntry,
  };

  /* istanbul ignore next */
  throw new Error('Internal error: should not be reading after end');
}
