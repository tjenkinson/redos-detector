import { buildCodePointRanges, toCodePoint } from './code-point';

function cp(input: string): number {
  const codePoint = toCodePoint(input);
  if (codePoint === null) throw new Error('Did not map to one code point');
  return codePoint;
}

describe('CodePoint', () => {
  describe('buildRanges', () => {
    it('works', () => {
      expect(
        buildCodePointRanges({
          caseInsensitive: true,
          highCodePoint: cp('a'),
          lowCodePoint: cp('a'),
        }),
      ).toStrictEqual([[cp('A'), cp('A')]]);

      expect(
        buildCodePointRanges({
          caseInsensitive: true,
          highCodePoint: cp('a'),
          lowCodePoint: cp('A'),
        }),
      ).toStrictEqual([[cp('A'), cp('`')]]);

      expect(
        buildCodePointRanges({
          caseInsensitive: true,
          highCodePoint: cp('a'),
          lowCodePoint: cp('C'),
        }),
      ).toStrictEqual([
        [cp('A'), cp('A')],
        [cp('C'), cp('`')],
      ]);

      expect(
        buildCodePointRanges({
          caseInsensitive: true,
          highCodePoint: cp(']'),
          lowCodePoint: cp('['),
        }),
      ).toStrictEqual([[cp('['), cp(']')]]);

      expect(
        buildCodePointRanges({
          caseInsensitive: true,
          highCodePoint: cp('}'),
          lowCodePoint: cp('Z'),
        }),
      ).toStrictEqual([
        [cp('A'), cp('`')],
        [cp('{'), cp('}')],
      ]);

      expect(
        buildCodePointRanges({
          caseInsensitive: false,
          highCodePoint: cp('}'),
          lowCodePoint: cp('Z'),
        }),
      ).toStrictEqual([[cp('Z'), cp('}')]]);

      expect(
        buildCodePointRanges({
          caseInsensitive: true,
          highCodePoint: cp('Ω'),
          lowCodePoint: cp('Ω'),
        }),
      ).toStrictEqual([[cp('Ω'), cp('Ω')]]);

      expect(
        buildCodePointRanges({
          caseInsensitive: true,
          highCodePoint: cp('ß'),
          lowCodePoint: cp('ß'),
        }),
      ).toStrictEqual([[cp('ß'), cp('ß')]]);
    });
  });
});
