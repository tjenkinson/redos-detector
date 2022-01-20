import {
  buildArrayReader,
  buildForkableReader,
  ForkableReader,
} from './reader';

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

    it('throws if next() is called after dispose', () => {
      reader.dispose();
      expect(() => reader.next()).toThrowError(
        'Internal error: reader disposed'
      );
    });

    it('allows dispose() to be called multiple times', () => {
      reader.dispose();
      reader.dispose();
    });
  });
});
