import {
  CharacterReaderLevel2,
  CharacterReaderLevel2ReturnValue,
  characterReaderLevel2TypeSplit,
  CharacterReaderLevel2Value,
} from './character-reader/character-reader-level-2';
import { ForkableReader, Reader, ReaderResult } from './reader';
import { fork } from 'forkable-iterator';
import { once } from './once';

export const isUnboundedReaderTypeStack: unique symbol = Symbol(
  'isUnboundedReaderTypeStack',
);

export type IsUnboundedReaderValueStack = {
  increase: number;
  type: typeof isUnboundedReaderTypeStack;
};

export type IsUnboundedReaderValue = Readonly<IsUnboundedReaderValueStack>;

export type IsUnboundedReader = Reader<IsUnboundedReaderValue, boolean>;

type StackFrame = Readonly<{
  get: () => ReaderResult<
    CharacterReaderLevel2Value,
    CharacterReaderLevel2ReturnValue
  >;
  reader: CharacterReaderLevel2;
}>;

/*
 * A reader that returns `true` if there could be nothing after the current
 * point  from the input reader.
 * I.e. anything that didn't match would fall outside the pattern
 * like the `b` in `aab` with pattern `^a+`
 */
export function* isUnboundedReader(
  inputReader: ForkableReader<
    CharacterReaderLevel2Value,
    CharacterReaderLevel2ReturnValue
  >,
): IsUnboundedReader {
  const reader = fork(inputReader);

  const stack: StackFrame[] = [{ get: once(() => reader.next()), reader }];
  yield {
    increase: 1,
    type: isUnboundedReaderTypeStack,
  };

  for (;;) {
    const frame = stack.pop();
    if (!frame) break;
    yield {
      increase: -1,
      type: isUnboundedReaderTypeStack,
    };

    const next = frame.get();
    if (next.done) {
      if (next.value.type === 'end' && !next.value.bounded) {
        yield {
          increase: -1 * stack.length,
          type: isUnboundedReaderTypeStack,
        };
        return true;
      }
    } else {
      if (next.value.type === characterReaderLevel2TypeSplit) {
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
        yield {
          increase: 2,
          type: isUnboundedReaderTypeStack,
        };
      }
    }
  }
  return false;
}
