import { buildForkableIterator, ForkableIterator } from 'forkable-iterator';

export type Reader<T, TReturn = void> = Iterator<T, TReturn>;
export type ReaderResult<T, TReturn = void> = IteratorResult<T, TReturn>;

// eslint-disable-next-line @typescript-eslint/no-empty-function
export function* emptyReader<T>(): Reader<T> {}

export type ForkableReader<T, TReturn = void> = ForkableIterator<T, TReturn>;

/**
 * Returns a reader that can be forked with the `fork` function.
 *
 * The source reader must not be read from directly.
 */
export function buildForkableReader<T, TReturn = void>(
  sourceReader: Reader<T, TReturn>,
): ForkableReader<T, TReturn> {
  return buildForkableIterator(sourceReader);
}

/**
 * Chains an array of readers together that run consecutively.
 */
export function* chainReaders<T>(readers: readonly Reader<T>[]): Reader<T> {
  for (const reader of readers) {
    let next: ReaderResult<T>;
    while (!(next = reader.next()).done) {
      yield next.value;
    }
  }
}

/**
 * Builds a reader that yields each item in the input array.
 */
export function* buildArrayReader<T>(input: readonly T[]): Reader<T> {
  yield* input;
}
