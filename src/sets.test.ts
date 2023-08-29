import { areSetsEqual, mergeSets, setsOverlap, subtractSets } from './sets';

describe('Sets', () => {
  describe('areSetsEqual', () => {
    it('works', () => {
      expect(areSetsEqual(new Set(), new Set())).toBe(true);
      expect(areSetsEqual(new Set([1]), new Set([]))).toBe(false);
      expect(areSetsEqual(new Set([]), new Set([1]))).toBe(false);
      expect(areSetsEqual(new Set([1]), new Set([1]))).toBe(true);
      expect(areSetsEqual(new Set([1, 2]), new Set([1, 3]))).toBe(false);
      expect(areSetsEqual(new Set([2, 1]), new Set([1, 2]))).toBe(true);
    });
  });

  describe('mergeSets', () => {
    it('works', () => {
      expect([...mergeSets(new Set(), new Set())]).toStrictEqual([]);
      expect([...mergeSets(new Set([1]), new Set([2]))].sort()).toStrictEqual([
        1, 2,
      ]);
      expect(
        [...mergeSets(new Set([1, 2]), new Set([2]))].sort(),
      ).toStrictEqual([1, 2]);
      expect(
        [...mergeSets(new Set([1, 2]), new Set([2, 3]))].sort(),
      ).toStrictEqual([1, 2, 3]);
    });
  });

  describe('subtractSets', () => {
    it('works', () => {
      expect([...subtractSets(new Set(), new Set())]).toStrictEqual([]);
      expect(
        [...subtractSets(new Set([1]), new Set([2]))].sort(),
      ).toStrictEqual([1]);
      expect(
        [...subtractSets(new Set([1, 2]), new Set([2]))].sort(),
      ).toStrictEqual([1]);
      expect(
        [...subtractSets(new Set([1, 2]), new Set([2, 3]))].sort(),
      ).toStrictEqual([1]);
    });
  });

  describe('setsOverlap', () => {
    it('works', () => {
      expect(setsOverlap(new Set(), new Set())).toBe(false);
      expect(setsOverlap(new Set([1]), new Set([]))).toBe(false);
      expect(setsOverlap(new Set([]), new Set([1]))).toBe(false);
      expect(setsOverlap(new Set([1]), new Set([1]))).toBe(true);
      expect(setsOverlap(new Set([1, 2]), new Set([1, 3]))).toBe(true);
      expect(setsOverlap(new Set([2, 1]), new Set([1, 2]))).toBe(true);
    });
  });
});
