export type Reader<T, TReturn = void> = Iterator<T, TReturn>;
export type ReaderResult<T, TReturn = void> = IteratorResult<T, TReturn>;

// eslint-disable-next-line @typescript-eslint/no-empty-function
export function* emptyReader<T>(): Reader<T> {}

export type ForkableReader<T, TReturn = void> = Reader<T, TReturn> & {
  dispose(): void;
  fork(): ForkableReader<T, TReturn>;
};

/**
 * Returns a reader that can be forked with the `fork` function.
 * To prevent memory leaks `dispose` should be called when finished.
 *
 * The source reader must not be read from directly.
 */
export function buildForkableReader<T, TReturn = void>(
  sourceReader: Reader<T, TReturn>
): ForkableReader<T, TReturn> {
  const onItem: Array<(item: T) => void> = [];
  let sourceDone = false;
  let returnVal: TReturn;

  const readSource = (): void => {
    if (sourceDone) return;
    const result = sourceReader.next();
    if (!result.done) {
      onItem.forEach((fn) => fn(result.value));
    } else {
      onItem.splice(0, onItem.length);
      sourceDone = true;
      returnVal = result.value;
    }
  };

  const makeFork = (initialPendingItems: T[]): ForkableReader<T, TReturn> => {
    const pendingItems: T[] = [...initialPendingItems];
    let handler: ((item: T) => void) | null = null;
    if (!sourceDone) {
      handler = (item: T): void => void pendingItems.push(item);
      onItem.push(handler);
    }

    const readSourceIfNeeded = (): void => {
      if (!pendingItems.length) {
        readSource();
      }
    };

    let disposed = false;
    const ensureNotDisposed = (): void => {
      if (disposed) throw new Error('Internal error: reader disposed');
    };

    const fork = (): ForkableReader<T, TReturn> => {
      ensureNotDisposed();
      return makeFork(pendingItems);
    };

    return {
      // technically does not need to be called if the source has been drained
      dispose(): void {
        if (disposed) return;
        disposed = true;
        if (handler) {
          const index = onItem.indexOf(handler);
          onItem.splice(index, 1);
        }
      },
      fork,
      next(): ReaderResult<T, TReturn> {
        ensureNotDisposed();
        readSourceIfNeeded();
        if (pendingItems.length) {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          return { value: pendingItems.shift()! };
        }
        return { done: true, value: returnVal };
      },
    };
  };

  return makeFork([]);
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
