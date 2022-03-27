import {
  CharacterReader,
  characterReaderTypeCharacterEntry,
  characterReaderTypeSplit,
  CharacterReaderValue,
  CharacterReaderValueGroups,
} from './character-reader-level-0';
import { ReaderResult } from '../reader';

/**
 * Maps each value of a `CharacterReader` from one value to another.
 *
 * It handles the `split` type internally.
 */
export function map(
  reader: CharacterReader,
  handle: (value: CharacterReaderValueGroups) => CharacterReaderValueGroups
): CharacterReader {
  const startThread = function* (
    innerReader: CharacterReader
  ): CharacterReader {
    let next: ReaderResult<CharacterReaderValue>;
    while (!(next = innerReader.next()).done) {
      const value = next.value;
      switch (value.type) {
        case characterReaderTypeSplit: {
          yield {
            reader: (): CharacterReader => startThread(value.reader()),
            type: characterReaderTypeSplit,
          };
          break;
        }
        case characterReaderTypeCharacterEntry: {
          yield handle(value);
          break;
        }
      }
    }
  };

  return startThread(reader);
}
