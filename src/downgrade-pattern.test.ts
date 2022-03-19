/* eslint-disable no-useless-backreference */
import {
  DowngradedRegexPattern,
  downgradePattern,
  getRawWithoutCapturingGroupsOrLookaheads,
} from './downgrade-pattern';
import { parse } from './parse';

function s(regex: RegExp): string {
  return regex.source;
}

const p = parse;

function expectResult(
  result: DowngradedRegexPattern,
  {
    atomicGroupOffsets = [],
    pattern,
  }: { atomicGroupOffsets?: number[]; pattern: string }
): void {
  expect(result.pattern).toBe(pattern);
  expect([...result.atomicGroupOffsets].sort((a, b) => a - b)).toStrictEqual(
    atomicGroupOffsets
  );
}

describe('DowngradePattern', () => {
  describe('downgradePattern()', () => {
    it('does not downgrade when not needed', () => {
      expectResult(downgradePattern({ pattern: 'ab', unicode: false }), {
        pattern: 'ab',
      });
      expectResult(
        downgradePattern({ pattern: s(/a(b)c\1/), unicode: false }),
        {
          pattern: s(/a(b)c\1/),
        }
      );
      expectResult(
        downgradePattern({ pattern: s(/a(?=(b)\1)c/), unicode: false }),
        {
          pattern: s(/a(?=(b)\1)c/),
        }
      );
      expectResult(
        downgradePattern({
          pattern: s(/a(?=(b(?=(c\1))))/),
          unicode: false,
        }),
        {
          pattern: s(/a(?=(b(?=(c\1))))/),
        }
      );
      expectResult(
        downgradePattern({
          pattern: s(/(a+\1)/),
          unicode: false,
        }),
        {
          pattern: s(/(a+\1)/),
        }
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
        }
      );
      expectResult(
        downgradePattern({
          pattern: s(/a(?=(b*))c\1/),
          unicode: false,
        }),
        {
          pattern: s(/a(?=(b*))c(?:b*)/),
        }
      );
      expectResult(
        downgradePattern({
          pattern: s(/a(?=(b))c\1+/),
          unicode: false,
        }),
        {
          pattern: s(/a(?=(b))c(?:b)+/),
        }
      );
      expectResult(
        downgradePattern({
          pattern: s(/a(?=(b)\1)\1c/),
          unicode: false,
        }),
        {
          pattern: s(/a(?=(b)\1)(?:b)c/),
        }
      );
      expectResult(
        downgradePattern({
          pattern: s(/a(?=(b))(c\1)/),
          unicode: false,
        }),
        {
          pattern: s(/a(?=(b))(c(?:b))/),
        }
      );
      expectResult(
        downgradePattern({
          pattern: s(/a(?=(b))((c\1))/),
          unicode: false,
        }),
        {
          pattern: s(/a(?=(b))((c(?:b)))/),
        }
      );
      expectResult(
        downgradePattern({
          pattern: s(/a(?=(b))(c\1)\2/),
          unicode: false,
        }),
        {
          pattern: s(/a(?=(b))(c(?:b))\2/),
        }
      );
      expectResult(
        downgradePattern({
          pattern: s(/a(b)(?=(c))(d\1)\2/),
          unicode: false,
        }),
        {
          pattern: s(/a(b)(?=(c))(d\1)(?:c)/),
        }
      );
      expectResult(
        downgradePattern({
          pattern: s(/a(?=(b(?=c)d))\1/),
          unicode: false,
        }),
        {
          atomicGroupOffsets: [14],
          pattern: s(/a(?=(b(?=c)d))(?:bd)/),
        }
      );
      expectResult(
        downgradePattern({
          pattern: s(/a(?=(b(?=(c\1))))\1\2/),
          unicode: false,
        }),
        {
          atomicGroupOffsets: [17],
          pattern: s(/a(?=(b(?=(c\1))))(?:b)(?:c(?:b))/),
        }
      );
      expectResult(
        downgradePattern({
          pattern: s(/a(?=(b)?)c\1/),
          unicode: false,
        }),
        {
          pattern: s(/a(?=(b)?)c(?:(?:b)?)/),
        }
      );
      expectResult(
        downgradePattern({
          pattern: s(/a(?=(b)|c)d\1/),
          unicode: false,
        }),
        {
          pattern: s(/a(?=(b)|c)d(?:(?:b)?)/),
        }
      );
      expectResult(
        downgradePattern({
          pattern: s(/a(?=(?:(b)|c))d\1/),
          unicode: false,
        }),
        {
          pattern: s(/a(?=(?:(b)|c))d(?:(?:b)?)/),
        }
      );
      expectResult(
        downgradePattern({
          pattern: s(/a(?=(?:(b))?)d\1/),
          unicode: false,
        }),
        {
          pattern: s(/a(?=(?:(b))?)d(?:(?:b)?)/),
        }
      );
      expectResult(
        downgradePattern({
          pattern: s(/a(?=(b{1,}?))c\1/),
          unicode: false,
        }),
        {
          pattern: s(/a(?=(b{1,}?))c(?:b{1,}?)/),
        }
      );
      expectResult(
        downgradePattern({
          pattern: s(/(?=(a))\1(?=(b))\2/),
          unicode: false,
        }),
        {
          atomicGroupOffsets: [7, 19],
          pattern: s(/(?=(a))(?:a)(?=(b))(?:b)/),
        }
      );
      expectResult(
        downgradePattern({
          pattern: s(/(?:(?=(a))\1)/),
          unicode: false,
        }),
        {
          atomicGroupOffsets: [10],
          pattern: s(/(?:(?=(a))(?:a))/),
        }
      );
      expectResult(
        downgradePattern({
          pattern: s(/((?=(a))\2){1,2}/),
          unicode: false,
        }),
        {
          atomicGroupOffsets: [8],
          pattern: s(/((?=(a))(?:a)){1,2}/),
        }
      );
      expectResult(
        downgradePattern({
          pattern: s(/(?=(a))(?=(b\1))\2/),
          unicode: false,
        }),
        {
          atomicGroupOffsets: [19],
          pattern: s(/(?=(a))(?=(b(?:a)))(?:b(?:a))/),
        }
      );
      expectResult(
        downgradePattern({
          pattern: s(/(?=(a))\1(?=(b))\1/),
          unicode: false,
        }),
        {
          atomicGroupOffsets: [7],
          pattern: s(/(?=(a))(?:a)(?=(b))(?:a)/),
        }
      );
      expectResult(
        downgradePattern({
          pattern: s(/(?=(a))(?=(\1))(?=(c))\3\2/),
          unicode: false,
        }),
        {
          atomicGroupOffsets: [25],
          pattern: s(/(?=(a))(?=((?:a)))(?=(c))(?:c)(?:(?:a))/),
        }
      );
      expectResult(
        downgradePattern({
          pattern: s(/a(?=(b(?!(c))))c\1/),
          unicode: false,
        }),
        {
          pattern: s(/a(?=(b(?!(c))))c(?:b)/),
        }
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
        }
      );
      expectResult(
        downgradePattern({
          pattern: s(/a(?=(b(?!(c))))c\2/),
          unicode: false,
        }),
        {
          pattern: s(/a(?=(b(?!(c))))c\2/),
        }
      );
      expectResult(
        downgradePattern({
          pattern: s(/a(?!(b(?=(c))))c\2/),
          unicode: false,
        }),
        {
          pattern: s(/a(?!(b(?=(c))))c\2/),
        }
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
        }
      );
      expectResult(
        downgradePattern({
          pattern: s(/(a+)\1/),
          unicode: false,
        }),
        {
          pattern: s(/(a+)(?:a+)/),
        }
      );
    });
  });

  describe('getRawWithoutCapturingGroups', () => {
    it('works', () => {
      expect(
        getRawWithoutCapturingGroupsOrLookaheads(p(s(/(a)/), false))
      ).toEqual({ containedReference: false, result: s(/(?:a)/) });
      expect(
        getRawWithoutCapturingGroupsOrLookaheads(
          p(
            s(
              /^(a)b{1}c+d{1,2}e+(?:f)(?=g)(?!h)(?<=i)(?<!j)(k|l).(m(n))o+?[a\d]\1$/
            ),
            false
          )
        )
      ).toEqual({
        containedReference: true,
        result: s(/^(?:a)b{1}c+d{1,2}e+(?:f)(?:k|l).(?:m(?:n))o+?[a\d]\1$/),
      });
    });
  });
});
