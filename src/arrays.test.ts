import { areArraysEqual, dropCommon, last } from './arrays';

describe('Arrays', () => {
  describe('last', () => {
    it('works', () => {
      expect(last([])).toBe(null);
      expect(last([0])).toBe(0);
      expect(last([0, 1])).toBe(1);
    });
  });

  describe('areArraysEqual', () => {
    it('works', () => {
      expect(areArraysEqual([], [])).toBe(true);
      expect(areArraysEqual([1], [1])).toBe(true);
      expect(areArraysEqual([1], [])).toBe(false);
      expect(areArraysEqual([1], [1, 2])).toBe(false);
      expect(areArraysEqual([1, 2], [1, 2])).toBe(true);
    });
  });

  describe('dropCommon', () => {
    it('works', () => {
      expect(dropCommon([], [])).toStrictEqual({ a: [], b: [] });
      expect(dropCommon([1], [2])).toStrictEqual({ a: [1], b: [2] });
      expect(dropCommon([1], [1])).toStrictEqual({ a: [], b: [] });
      expect(dropCommon([1, 2], [1, 2])).toStrictEqual({ a: [], b: [] });
      expect(dropCommon([0, 1, 2], [1, 2])).toStrictEqual({
        a: [0, 1, 2],
        b: [1, 2],
      });
      expect(dropCommon([1, 2], [1, 2, 3])).toStrictEqual({
        a: [],
        b: [3],
      });
      expect(dropCommon([1, 2, 3], [1, 2])).toStrictEqual({
        a: [3],
        b: [],
      });
      expect(dropCommon([1, 2], [1, 3, 4])).toStrictEqual({
        a: [2],
        b: [3, 4],
      });
    });
  });
});
