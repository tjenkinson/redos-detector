import {
  CharacterReader,
  characterReaderTypeCharacterEntry,
} from '../character-reader/character-reader-level-0';

export function* buildNullCharacterReader(offset: number): CharacterReader {
  yield {
    offset,
    stack: [],
    subType: 'null',
    type: characterReaderTypeCharacterEntry,
  };
}
