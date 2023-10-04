import { createRanges, intersectRanges, subtractRanges } from './our-range';

describe('OurRange', () => {
  describe('intersectRanges', () => {
    it('works', () => {
      expect(intersectRanges([0, 1], [2, 3])).toBe(null);

      expect(intersectRanges([1, 1], [1, 1])).toStrictEqual({
        a: [],
        b: [],
        shared: [1, 1],
      });

      expect(intersectRanges([0, 1], [1, 2])).toStrictEqual({
        a: [[0, 0]],
        b: [[2, 2]],
        shared: [1, 1],
      });

      expect(intersectRanges([1, 2], [0, 3])).toStrictEqual({
        a: [],
        b: [
          [0, 0],
          [3, 3],
        ],
        shared: [1, 2],
      });

      expect(intersectRanges([1, 4], [3, 6])).toStrictEqual({
        a: [[1, 2]],
        b: [[5, 6]],
        shared: [3, 4],
      });
    });
  });

  describe('subtractRanges', () => {
    it('works', () => {
      expect(subtractRanges([1, 3], [1, 3])).toStrictEqual([]);
      expect(subtractRanges([1, 3], [1, 2])).toStrictEqual([[3, 3]]);
      expect(subtractRanges([0, 3], [1, 2])).toStrictEqual([
        [0, 0],
        [3, 3],
      ]);
      expect(subtractRanges([0, 5], [2, 3])).toStrictEqual([
        [0, 1],
        [4, 5],
      ]);
    });
  });

  describe('createRanges', () => {
    it('works', () => {
      expect(createRanges(new Set())).toStrictEqual([]);
      expect(createRanges(new Set([1]))).toStrictEqual([[1, 1]]);
      expect(createRanges(new Set([1, 2]))).toStrictEqual([[1, 2]]);
      expect(createRanges(new Set([1, 3]))).toStrictEqual([
        [1, 1],
        [3, 3],
      ]);
      expect(createRanges(new Set([1, 2, 3]))).toStrictEqual([[1, 3]]);
      expect(createRanges(new Set([5, 4, 1, 0]))).toStrictEqual([
        [0, 1],
        [4, 5],
      ]);
    });
  });
});
