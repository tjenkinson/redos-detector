import {
  CharacterReader,
  characterReaderTypeCharacterEntry,
  characterReaderTypeSplit,
  CharacterReaderValue,
} from './character-reader-level-0';
import { emptyReader, ReaderResult } from '../reader';

export type JoinGetAction = (
  index: number,
  emittedSomething: number
) => 'continue' | 'fork' | 'stop';

/**
 * Join multiple `CharacterReader`'s together.
 *
 * It has understanding of the `split` type.
 *
 * `getAction` should return
 * - `continue`: This results in `getReader` being called with the next index
 *   and a new `CharacterReader` should be returned
 * - `fork`: This results in the reader splitting, with the split reader being empty,
 *   and then `getReader` is called with the next index and a new `CharacterReader`
 *   should be returned
 * - `stop`: This means the reader will end
 */
export function join(
  getAction: JoinGetAction,
  getReader: (index: number) => CharacterReader
): CharacterReader {
  const _join = function* (
    _getAction: JoinGetAction,
    _getReader: (index: number) => CharacterReader,
    timeSinceEmitSomething = 0
  ): CharacterReader {
    for (let i = 0; ; i++) {
      const action = _getAction(i, timeSinceEmitSomething);
      if (action === 'stop') {
        return;
      } else if (action === 'fork') {
        yield {
          reader: (): CharacterReader => emptyReader(),
          subType: null,
          type: characterReaderTypeSplit,
        };
      }

      let emittedSomething = false;

      const reader = _getReader(i);
      let next: ReaderResult<CharacterReaderValue>;
      while (!(next = reader.next()).done) {
        const value = next.value;

        switch (value.type) {
          case characterReaderTypeSplit: {
            const _i = i;
            const _timeSinceEmittedSomething = timeSinceEmitSomething;
            yield {
              reader: (): CharacterReader =>
                _join(
                  (innerIndex, innerTimeSinceEmittedSomething) => {
                    return innerIndex === 0
                      ? 'continue'
                      : _getAction(
                          innerIndex + _i,
                          innerTimeSinceEmittedSomething
                        );
                  },
                  (innerIndex) => {
                    return innerIndex === 0
                      ? value.reader()
                      : _getReader(innerIndex + _i);
                  },
                  _timeSinceEmittedSomething
                ),
              subType: value.subType,
              type: characterReaderTypeSplit,
            };
            break;
          }
          case characterReaderTypeCharacterEntry: {
            if (
              value.subType !== 'null' &&
              value.subType !== 'start' &&
              value.subType !== 'end'
            ) {
              emittedSomething = true;
            }
            yield value;
            break;
          }
        }
      }

      timeSinceEmitSomething = emittedSomething
        ? 0
        : timeSinceEmitSomething + 1;
    }
  };

  return _join(getAction, getReader);
}

/**
 * Joins an array of `CharacterReader`'s together, with  understanding
 * of the `split` type. If a reader splits, when the split reader ends,
 * the next `CharacterReader` in the array will follow.
 */
export function joinArray(
  input: readonly (() => CharacterReader)[]
): CharacterReader {
  const length = input.length;
  return join(
    (i) => (i < length ? 'continue' : 'stop'),
    (i) => input[i]()
  );
}
