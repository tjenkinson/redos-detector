import {
  CharacterReader,
  characterReaderTypeCharacterEntry,
} from '../character-reader/character-reader';

export function* buildNullCharacterReader(offset: number): CharacterReader {
  yield {
    groups: new Map(),
    lookaheadStack: [],
    offset,
    quantifierStack: [],
    subType: 'null',
    type: characterReaderTypeCharacterEntry,
  };
}
