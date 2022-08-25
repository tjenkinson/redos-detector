import { buildArrayReader, chainReaders, emptyReader } from './reader';

describe('Reader', () => {
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
