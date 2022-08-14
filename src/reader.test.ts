import {
  buildArrayReader,
  buildForkableReader,
  chainReaders,
  emptyReader,
  ForkableReader,
} from './reader';

if (!global.gc) {
  throw new Error('node --expose-gc flag required');
}

const gc: () => void = global.gc;

describe('Reader', () => {
  describe('ForkableReader', () => {
    let reader: ForkableReader<number, void>;
    beforeEach(() => {
      reader = buildForkableReader(buildArrayReader([1, 2, 3]));
    });

    it('yields the correct items', () => {
      const fork = reader.fork();
      expect(fork.next().value).toBe(1);
      expect(fork.next().value).toBe(2);

      expect(reader.next().value).toBe(1);

      const fork2 = reader.fork();
      expect(reader.next().value).toBe(2);

      expect(fork2.next().value).toBe(2);

      expect(reader.next().value).toBe(3);
      expect(reader.next().value).toBe(undefined);

      expect(fork.next().value).toBe(3);
      expect(fork.next().value).toBe(undefined);

      expect(fork2.next().value).toBe(3);
      expect(fork2.next().value).toBe(undefined);
    });

    it('gcs a fork when it is no longer referenced', async () => {
      const fork = reader.fork();
      fork.next();

      const fork2 = new WeakRef(reader.fork());

      await new Promise((resolve) => setTimeout(resolve, 0));
      gc();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(fork2.deref()).toBe(undefined);
    });
  });

  describe('chainReaders()', () => {
    it('yields the correct items', () => {
      const reader = chainReaders([
        buildArrayReader([0, 1]),
        buildArrayReader([2, 3]),
      ]);
      expect(reader.next().value).toBe(0);
      expect(reader.next().value).toBe(1);
      expect(reader.next().value).toBe(2);
      expect(reader.next().value).toBe(3);
      expect(reader.next().done).toBe(true);
    });
  });

  describe('emptyReader()', () => {
    it('is immediately done', () => {
      expect(emptyReader().next().done).toBe(true);
    });
  });
});
