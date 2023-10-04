import { buildCodePointRanges, toCodePoint } from './code-point';

describe('CodePoint', () => {
  describe('buildRanges', () => {
    it('works', () => {
      expect(
        buildCodePointRanges({
          caseInsensitive: true,
          highCodePoint: toCodePoint('a'),
          lowCodePoint: toCodePoint('a'),
        }),
      ).toStrictEqual([[toCodePoint('a'), toCodePoint('a')]]);

      expect(
        buildCodePointRanges({
          caseInsensitive: true,
          highCodePoint: toCodePoint('a'),
          lowCodePoint: toCodePoint('A'),
        }),
      ).toStrictEqual([[toCodePoint('['), toCodePoint('z')]]);

      expect(
        buildCodePointRanges({
          caseInsensitive: true,
          highCodePoint: toCodePoint('a'),
          lowCodePoint: toCodePoint('C'),
        }),
      ).toStrictEqual([
        [toCodePoint('['), toCodePoint('a')],
        [toCodePoint('c'), toCodePoint('z')],
      ]);

      expect(
        buildCodePointRanges({
          caseInsensitive: true,
          highCodePoint: toCodePoint(']'),
          lowCodePoint: toCodePoint('['),
        }),
      ).toStrictEqual([[toCodePoint('['), toCodePoint(']')]]);

      expect(
        buildCodePointRanges({
          caseInsensitive: true,
          highCodePoint: toCodePoint('}'),
          lowCodePoint: toCodePoint('Z'),
        }),
      ).toStrictEqual([[toCodePoint('['), toCodePoint('}')]]);

      expect(
        buildCodePointRanges({
          caseInsensitive: false,
          highCodePoint: toCodePoint('}'),
          lowCodePoint: toCodePoint('Z'),
        }),
      ).toStrictEqual([[toCodePoint('Z'), toCodePoint('}')]]);
    });
  });
});
