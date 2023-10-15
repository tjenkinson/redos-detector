import {
  createRanges,
  intersectRanges,
  invertRanges,
  subtractRanges,
} from './our-range';

describe('OurRange', () => {
  describe('intersectRanges', () => {
    it('works', () => {
      expect(intersectRanges([0, 1], [2, 3])).toBe(null);
      expect(intersectRanges([1, 1], [1, 1])).toStrictEqual([1, 1]);
      expect(intersectRanges([0, 1], [1, 2])).toStrictEqual([1, 1]);
      expect(intersectRanges([1, 2], [0, 3])).toStrictEqual([1, 2]);
      expect(intersectRanges([1, 4], [3, 6])).toStrictEqual([3, 4]);
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

    describe('invertRanges', () => {
      it('works', () => {
        expect(invertRanges([])).toStrictEqual([[-Infinity, Infinity]]);
        expect(invertRanges([[0, 0]])).toStrictEqual([
          [-Infinity, -1],
          [1, Infinity],
        ]);
        expect(invertRanges([[1, 2]])).toStrictEqual([
          [-Infinity, 0],
          [3, Infinity],
        ]);
        expect(
          invertRanges([
            [1, 2],
            [3, 4],
          ]),
        ).toStrictEqual([
          [-Infinity, 0],
          [5, Infinity],
        ]);
        expect(
          invertRanges([
            [1, 2],
            [4, 6],
            [10, 12],
          ]),
        ).toStrictEqual([
          [-Infinity, 0],
          [3, 3],
          [7, 9],
          [13, Infinity],
        ]);
      });
      expect(() =>
        invertRanges([
          [1, 1],
          [0, 0],
        ]),
      ).toThrowError('Internal error: invalid ranges input');
    });
  });
});
