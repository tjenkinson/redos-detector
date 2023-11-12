import {
  CharacterGroups,
  intersectCharacterGroups,
  isEmptyCharacterGroups,
} from './character-groups';
import {
  CharacterReaderLevel2,
  CharacterReaderLevel2ReturnValue,
  characterReaderLevel2TypeEntry,
  characterReaderLevel2TypeSplit,
  CharacterReaderLevel2Value,
} from './character-reader/character-reader-level-2';
import { ForkableReader, Reader, ReaderResult } from './reader';
import { fork } from 'forkable-iterator';
import { once } from './once';

export const isUnboundedReaderTypeStep: unique symbol = Symbol(
  'isUnboundedReaderTypeStep',
);

export type IsUnboundedReaderValueStep = {
  type: typeof isUnboundedReaderTypeStep;
};

export type IsUnboundedReaderValue = Readonly<IsUnboundedReaderValueStep>;

export type IsUnboundedReader = Reader<IsUnboundedReaderValue, boolean>;

type StackFrame = Readonly<{
  get: () => ReaderResult<
    CharacterReaderLevel2Value,
    CharacterReaderLevel2ReturnValue
  >;
  reader: CharacterReaderLevel2;
}>;

const notNewLine: CharacterGroups = {
  negated: true,
  ranges:
    // [\n\r\u2028-\u2029]
    [
      [10, 10],
      [13, 13],
      [8232, 8233],
    ],
  unicodePropertyEscapes: new Set(),
};

/*
 * A reader that returns `true` if there could be nothing after the current
 * point  from the input reader.
 * I.e. anything that didn't match would fall outside the pattern
 * like the `b` in `aab` with pattern `^a+`
 */
export function* isUnboundedReader({
  multiLine,
  reader: inputReader,
}: {
  multiLine: boolean;
  reader: ForkableReader<
    CharacterReaderLevel2Value,
    CharacterReaderLevel2ReturnValue
  >;
}): IsUnboundedReader {
  const reader = fork(inputReader);

  const stack: StackFrame[] = [{ get: once(() => reader.next()), reader }];

  for (;;) {
    const frame = stack.pop();
    if (!frame) break;

    yield {
      type: isUnboundedReaderTypeStep,
    };

    const next = frame.get();
    if (next.done) {
      if (next.value.type === 'end' && !next.value.bounded) {
        return true;
      }
    } else {
      switch (next.value.type) {
        case characterReaderLevel2TypeSplit: {
          const value = next.value;
          const splitReader = value.reader();
          stack.push({
            get: once(() => frame.reader.next()),
            reader: frame.reader,
          });
          stack.push({
            get: once(() => splitReader.next()),
            reader: splitReader,
          });
          break;
        }
        case characterReaderLevel2TypeEntry: {
          if (multiLine) {
            const isNewLine = isEmptyCharacterGroups(
              intersectCharacterGroups(notNewLine, next.value.characterGroups),
            );
            if (isNewLine) {
              stack.push({
                get: once(() => frame.reader.next()),
                reader: frame.reader,
              });
            }
          }
          break;
        }
      }
    }
  }
  return false;
}
