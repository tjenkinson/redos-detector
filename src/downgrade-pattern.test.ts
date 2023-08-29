/* eslint-disable no-useless-backreference, redos-detector/no-unsafe-regex */
import {
  DowngradedRegexPattern,
  downgradePattern,
  getRawWithoutCapturingGroupsOrLookaheads,
  RawWithoutCapturingGroupsOrLookaheads,
} from './downgrade-pattern';
import { parse } from './parse';

function s(regex: RegExp): string {
  return regex.source;
}

const p = parse;

describe('DowngradePattern', () => {
  describe('downgradePattern()', () => {
    const expectResult = (
      result: DowngradedRegexPattern,
      {
        atomicGroupOffsets = [],
        pattern,
      }: { atomicGroupOffsets?: number[]; pattern: string },
    ): void => {
      expect(result.pattern).toBe(pattern);
      expect(
        [...result.atomicGroupOffsets].sort((a, b) => a - b),
      ).toStrictEqual(atomicGroupOffsets);
    };

    it('does not downgrade when not needed', () => {
      expectResult(downgradePattern({ pattern: 'ab', unicode: false }), {
        pattern: 'ab',
      });
      expectResult(
        downgradePattern({ pattern: s(/a(b)c\1/), unicode: false }),
        {
          pattern: s(/a(b)c\1/),
        },
      );
      expectResult(
        downgradePattern({ pattern: s(/a(?=(b)\1)c/), unicode: false }),
        {
          pattern: s(/a(?=(b)\1)c/),
        },
      );
      expectResult(
        downgradePattern({
          pattern: s(/a(?=(b(?=(c\1))))/),
          unicode: false,
        }),
        {
          pattern: s(/a(?=(b(?=(c\1))))/),
        },
      );
      expectResult(
        downgradePattern({
          pattern: s(/(a+\1)/),
          unicode: false,
        }),
        {
          pattern: s(/(a+\1)/),
        },
      );
    });

    it('downgrades when group in a positive lookahead', () => {
      expectResult(
        downgradePattern({
          pattern: s(/a(?=(b))c\1/),
          unicode: false,
        }),
        {
          pattern: s(/a(?=(b))c(?:b)/),
        },
      );
      expectResult(
        downgradePattern({
          pattern: s(/a(?=(b*))c\1/),
          unicode: false,
        }),
        {
          pattern: s(/a(?=(b*))c(?:b*)/),
        },
      );
      expectResult(
        downgradePattern({
          pattern: s(/a(?=(b))c\1+/),
          unicode: false,
        }),
        {
          pattern: s(/a(?=(b))c(?:b)+/),
        },
      );
      expectResult(
        downgradePattern({
          pattern: s(/a(?=(b)\1)\1c/),
          unicode: false,
        }),
        {
          pattern: s(/a(?=(b)\1)(?:b)c/),
        },
      );
      expectResult(
        downgradePattern({
          pattern: s(/a(?=(b))(c\1)/),
          unicode: false,
        }),
        {
          pattern: s(/a(?=(b))(c(?:b))/),
        },
      );
      expectResult(
        downgradePattern({
          pattern: s(/a(?=(b))((c\1))/),
          unicode: false,
        }),
        {
          pattern: s(/a(?=(b))((c(?:b)))/),
        },
      );
      expectResult(
        downgradePattern({
          pattern: s(/a(?=(b))(c\1)\2/),
          unicode: false,
        }),
        {
          pattern: s(/a(?=(b))(c(?:b))\2/),
        },
      );
      expectResult(
        downgradePattern({
          pattern: s(/a(b)(?=(c))(d\1)\2/),
          unicode: false,
        }),
        {
          pattern: s(/a(b)(?=(c))(d\1)(?:c)/),
        },
      );
      expectResult(
        downgradePattern({
          pattern: s(/a(?=(b(?=c)d))\1/),
          unicode: false,
        }),
        {
          atomicGroupOffsets: [14],
          pattern: s(/a(?=(b(?=c)d))(?:bd)/),
        },
      );
      expectResult(
        downgradePattern({
          pattern: s(/a(?=(b(?=(c\1))))\1\2/),
          unicode: false,
        }),
        {
          atomicGroupOffsets: [17],
          pattern: s(/a(?=(b(?=(c\1))))(?:b)(?:c(?:b))/),
        },
      );
      expectResult(
        downgradePattern({
          pattern: s(/a(?=(b)?)c\1/),
          unicode: false,
        }),
        {
          pattern: s(/a(?=(b)?)c(?:(?:b)?)/),
        },
      );
      expectResult(
        downgradePattern({
          pattern: s(/a(?=(b)|c)d\1/),
          unicode: false,
        }),
        {
          pattern: s(/a(?=(b)|c)d(?:(?:b)?)/),
        },
      );
      expectResult(
        downgradePattern({
          pattern: s(/a(?=(?:(b)|c))d\1/),
          unicode: false,
        }),
        {
          pattern: s(/a(?=(?:(b)|c))d(?:(?:b)?)/),
        },
      );
      expectResult(
        downgradePattern({
          pattern: s(/a(?=(?:(b))?)d\1/),
          unicode: false,
        }),
        {
          pattern: s(/a(?=(?:(b))?)d(?:(?:b)?)/),
        },
      );
      expectResult(
        downgradePattern({
          pattern: s(/a(?=(b{1,}?))c\1/),
          unicode: false,
        }),
        {
          pattern: s(/a(?=(b{1,}?))c(?:b{1,}?)/),
        },
      );
      expectResult(
        downgradePattern({
          pattern: s(/(?=(a))\1(?=(b))\2/),
          unicode: false,
        }),
        {
          atomicGroupOffsets: [7, 19],
          pattern: s(/(?=(a))(?:a)(?=(b))(?:b)/),
        },
      );
      expectResult(
        downgradePattern({
          pattern: s(/(?:(?=(a))\1)/),
          unicode: false,
        }),
        {
          atomicGroupOffsets: [10],
          pattern: s(/(?:(?=(a))(?:a))/),
        },
      );
      expectResult(
        downgradePattern({
          pattern: s(/((?=(a))\2){1,2}/),
          unicode: false,
        }),
        {
          atomicGroupOffsets: [8],
          pattern: s(/((?=(a))(?:a)){1,2}/),
        },
      );
      expectResult(
        downgradePattern({
          pattern: s(/(?=(a))(?=(b\1))\2/),
          unicode: false,
        }),
        {
          atomicGroupOffsets: [19],
          pattern: s(/(?=(a))(?=(b(?:a)))(?:b(?:a))/),
        },
      );
      expectResult(
        downgradePattern({
          pattern: s(/(?=(a))\1(?=(b))\1/),
          unicode: false,
        }),
        {
          atomicGroupOffsets: [7],
          pattern: s(/(?=(a))(?:a)(?=(b))(?:a)/),
        },
      );
      expectResult(
        downgradePattern({
          pattern: s(/(?=(a))(?=(\1))(?=(c))\3\2/),
          unicode: false,
        }),
        {
          atomicGroupOffsets: [25],
          pattern: s(/(?=(a))(?=((?:a)))(?=(c))(?:c)(?:(?:a))/),
        },
      );
      expectResult(
        downgradePattern({
          pattern: s(/a(?=(b(?!(c))))c\1/),
          unicode: false,
        }),
        {
          pattern: s(/a(?=(b(?!(c))))c(?:b)/),
        },
      );
    });

    it('downgrades when group in a positive lookahead and handles nested atomic group', () => {
      expectResult(
        downgradePattern({
          pattern: s(/^(?=((?=(a*))\2b*))\1c*$/),
          unicode: false,
        }),
        {
          atomicGroupOffsets: [13, 23, 26],
          pattern: s(/^(?=((?=(a*))(?:a*)b*))(?:(?:a*)b*)c*$/),
        },
      );
    });

    it('does not downgrade when group in a negative lookahead', () => {
      expectResult(
        downgradePattern({
          pattern: s(/a(?!(b))c\1/),
          unicode: false,
        }),
        {
          pattern: s(/a(?!(b))c\1/),
        },
      );
      expectResult(
        downgradePattern({
          pattern: s(/a(?=(b(?!(c))))c\2/),
          unicode: false,
        }),
        {
          pattern: s(/a(?=(b(?!(c))))c\2/),
        },
      );
      expectResult(
        downgradePattern({
          pattern: s(/a(?!(b(?=(c))))c\2/),
          unicode: false,
        }),
        {
          pattern: s(/a(?!(b(?=(c))))c\2/),
        },
      );
    });

    it('downgrades when group is non finite size', () => {
      expectResult(
        downgradePattern({
          pattern: s(/(a*)\1/),
          unicode: false,
        }),
        {
          pattern: s(/(a*)(?:a*)/),
        },
      );
      expectResult(
        downgradePattern({
          pattern: s(/(a+)\1/),
          unicode: false,
        }),
        {
          pattern: s(/(a+)(?:a+)/),
        },
      );
      expectResult(
        downgradePattern({
          pattern: s(/(a+(?=b+))\1/),
          unicode: false,
        }),
        {
          pattern: s(/(a+(?=b+))(?:a+)/),
        },
      );
    });

    it('does not downgrade when a lookahead group is not finite size', () => {
      expectResult(
        downgradePattern({
          pattern: s(/(a(?=b+))\1/),
          unicode: false,
        }),
        {
          pattern: s(/(a(?=b+))\1/),
        },
      );
    });
  });

  describe('getRawWithoutCapturingGroups', () => {
    const expectResult = (
      result: RawWithoutCapturingGroupsOrLookaheads,
      {
        references,
        result: resultResult,
      }: {
        references: Record<string, number>;
        result: string;
      },
    ): void => {
      expect(result.result).toBe(resultResult);
      expect(
        Object.fromEntries(
          [...result.referencesWithOffset].map(([reference, offset]) => {
            return [reference.raw, offset];
          }),
        ),
      ).toStrictEqual(references);
    };

    it('works', () => {
      expectResult(
        getRawWithoutCapturingGroupsOrLookaheads(p(s(/(a)/), false)),
        { references: {}, result: s(/(?:a)/) },
      );
      expectResult(
        getRawWithoutCapturingGroupsOrLookaheads(
          p(
            s(
              /^(a)b{1}c+d{1,2}e+(?:f)(?=g)(?!h)(?<=i)(?<!j)(k|l).(m(n))o+?[a\d]\1$/,
            ),
            false,
          ),
        ),
        {
          references: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            '\\1': 51,
          },
          result: s(/^(?:a)b{1}c+d{1,2}e+(?:f)(?:k|l).(?:m(?:n))o+?[a\d]\1$/),
        },
      );
      expectResult(
        getRawWithoutCapturingGroupsOrLookaheads(
          p(s(/()()()()a(\1)c(d|\2|f)(?:\3)(?:\4)+/), false),
        ),
        {
          /* eslint-disable @typescript-eslint/naming-convention */
          references: {
            '\\1': 20,
            '\\2': 29,
            '\\3': 37,
            '\\4': 43,
          },
          /* eslint-enable @typescript-eslint/naming-convention */
          result: s(/(?:)(?:)(?:)(?:)a(?:\1)c(?:d|\2|f)(?:\3)(?:\4)+/),
        },
      );
    });
  });
});
