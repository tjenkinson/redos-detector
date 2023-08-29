import { areMapsEqual, getOrCreate, mustGet } from './map';

describe('Map', () => {
  describe('getOrCreate', () => {
    it('works', () => {
      const map = new Map<string, number>();
      map.set('a', 1);
      const buildFn = jest.fn();

      expect(getOrCreate(map, 'a', buildFn)).toBe(1);
      expect(buildFn).toHaveBeenCalledTimes(0);

      expect(getOrCreate(map, 'b', () => 2)).toBe(2);
      expect(map.get('b')).toBe(2);
    });
  });

  describe('areMapsEqual()', () => {
    it('works', () => {
      const a = new Map<string, number>();
      const b = new Map<string, number>();
      expect(areMapsEqual(a, b)).toBe(true);

      a.set('a', 1);
      b.set('a', 1);
      expect(areMapsEqual(a, b)).toBe(true);

      a.set('a', 2);
      expect(areMapsEqual(a, b)).toBe(false);

      a.delete('a');
      expect(areMapsEqual(a, b)).toBe(false);
    });
  });

  describe('mustGet', () => {
    it('works', () => {
      const map = new Map<string, number>();
      map.set('a', 1);

      expect(mustGet(map, 'a')).toBe(1);
      expect(() => mustGet(map, 'b')).toThrowError(
        'Internal error: map missing key',
      );
    });
  });
});
