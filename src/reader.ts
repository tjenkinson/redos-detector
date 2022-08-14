export type Reader<T, TReturn = void> = Iterator<T, TReturn>;
export type ReaderResult<T, TReturn = void> = IteratorResult<T, TReturn>;

// eslint-disable-next-line @typescript-eslint/no-empty-function
export function* emptyReader<T>(): Reader<T> {}

const pendingItemsSymbol = Symbol('pendingItems');

export type ForkableReader<T, TReturn = void> = Reader<T, TReturn> & {
  fork(): ForkableReader<T, TReturn>;
  [pendingItemsSymbol]: T[];
};

/**
 * Returns a reader that can be forked with the `fork` function.
 *
 * The source reader must not be read from directly.
 */
export function buildForkableReader<T, TReturn = void>(
  sourceReader: Reader<T, TReturn>
): ForkableReader<T, TReturn> {
  const onItem: Array<(item: T) => void> = [];
  let sourceDone = false;
  let returnVal: TReturn;

  const registry = new FinalizationRegistry<(item: T) => void>(
    (onItemCallback) => {
      const index = onItem.indexOf(onItemCallback);
      if (index >= 0) onItem.splice(index, 1);
    }
  );

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
    const reader: ForkableReader<T, TReturn> = {
      fork() {
        return makeFork(this[pendingItemsSymbol]);
      },
      next(): ReaderResult<T, TReturn> {
        const pendingItems = this[pendingItemsSymbol];
        if (!pendingItems.length) {
          readSource();
        }
        if (pendingItems.length) {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          return { value: pendingItems.shift()! };
        }
        return { done: true, value: returnVal };
      },
      [pendingItemsSymbol]: [...initialPendingItems],
    };

    if (!sourceDone) {
      const ref = new WeakRef(reader);
      const callback = (item: T): void => {
        const maybeReader = ref.deref();
        /* istanbul ignore next */
        maybeReader?.[pendingItemsSymbol].push(item);
      };
      registry.register(reader, callback);
      onItem.push(callback);
    }

    return reader;
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
