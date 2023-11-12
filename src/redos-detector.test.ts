/* eslint-disable no-control-regex, no-useless-backreference, redos-detector/no-unsafe-regex */
import {
  downgradePattern,
  isSafe,
  isSafePattern,
  toFriendly,
  version,
} from './redos-detector';

describe('RedosDetector', () => {
  it('exports the version', () => {
    expect(version).toBe('mockVersion');
  });

  it('exports `toFriendly`', () => {
    expect(toFriendly).toBeTruthy();
  });

  describe('isSafe', () => {
    describe('cases', () => {
      type Case = [RegExp, boolean | 'noIgnoreSnapshot'];

      const cases: Case[] = [
        [/()/, true],
        [/z(ab){1,2}abab{0,2}$/, false],
        [/z(ab){1,2}abab(ab){0,2}$/, false],
        [/[ab]{0,2}a?$/, false],
        [/([^\\wb]){0,2}[\\wa]?a$/, false],
        [/([^\\db]){0,2}[\\d]?$/, true],
        [/([^\\db]){0,2}[\\d]?a$/, false],
        [/a*ba*$/, true],
        [/a*b?a*$/, false],
        [/([^\\w]){0,2}[a]?$/, false],
        [/(.b.b){1,2}.(.a){0,4}a$/, false],
        [/(abab){0,3}a(ba){0,1}baa$/, false],
        [/(abc?){0,2}(abab){0,1}$/, false],
        [/(a{1,3}b){1,2}(ab){1,4}a$/, false],
        [/[ab]?[ab]x*b?$/, false],
        [/[ab]*[ac]?$/, false],
        [/(ab)*(ab)?$/, false],
        [/(ab)*a(ba){0,2}$/, false],
        [/(a+b)+(a+b)+f$/, false],
        [/(a*)*/, true],
        [/a*a*/, true],
        [/(a*)*$/, false],
        [/(a+b)*((a+b)+[ax]b)?$/, false],
        [/(a+b)*((a+b)[ax]b)?$/, false],
        [/(a+b)*(a+c)+$/, false],
        [/(a{1,2}b)*(a{1,2}c){1,2}$/, false],
        [/(a{1,2}b?)*(a{1,2}c){1,2}$/, false],
        [/(a{1,2}b)*(a{1,2}b){1,2}$/, false],
        [/(a{1,2}b)*(ab){1,2}$/, false],
        [/(a{0,1}b)*(a{0,2}b){1,2}$/, false],
        [/(a{0,1}b)*(a{1,2}b){0,1}$/, false],
        [/(a{1,2}b)*(a{1,2}b){1,2}$/, false],
        [/(a{1,2}b)*(a{1,2}b){0,1}$/, false],
        [/(a{1,3}b)*(a{1,2}b){1,2}$/, false],
        [/(a{1,3})*(a{1,2}){1,2}$/, false],
        [/a*(a{1,2}){1,2}$/, false],
        [/(a{1,2})*$/, false],
        [/(a{1,2})*(a{1,2}c){1,2}$/, false],
        [/(a{1,2})+(ac){0,1}$/, false],
        [/(ab)*((ab)+c)+$/, false],
        [/[ab]*ab*c$/, false],
        [/[ab]*cb*c$/, true],
        [/(a+b){0,10}(a+b){1,2}$/, false],
        [/[ab]*(ab)+$/, false],
        [/(ab)+(a+b)*$/, false],
        [/(a+b)+(a+c)+f$/, false],
        [/(aa)*(aaa)?$/, false],
        [/(aa)*a?(aaa)?/, false],
        [/(){2,3}aa?a?$/, false],
        [/([^bc]){0,2}b?$/, true],
        [/(aaaa){0,2}(a){0,10}$/, false],
        [/a{0,2}(aa)?$/, false],
        [/a{0,2}(aaa)?$/, false],
        [/(ab){0,2}(ab)?$/, false],
        [/(ab){0,2}(abab)?$/, false],
        [/(ab){0,2}(ababab)?$/, false],
        [/(ab){0,2}a(ba)?$/, false],
        [/(ab){0,2}a(baba)?$/, false],
        [/(ab){0,2}a(bababa)?$/, false],
        [/(abc?){0,2}a(bababa)?$/, false],
        [/(a|b){0,2}a?$/, false],
        [/(a|b){0,2}(a|b)?$/, false],
        [/(a|b){0,2}c?$/, true],
        [/(){0,2}c?$/, true],
        [/()*c?$/, true],
        [/()*c?()*$/, true],
        [/a*()*b*$/, true],
        [/a*()*a*$/, false],
        [/(a|b*)b+$/, false],
        [/[^]+a*$/, false],
        [/\d+[0-9]*$/, false],
        [/[^\d]+[0-9]*$/, true],
        [/\D+[0-9]*$/, true],
        [/[\D\d]+[0-9]*$/, false],
        [/[\D1]+[0-9]*$/, false],
        [/\D+\d*$/, true],
        [/[^\w]+a*$/, true],
        [/\w+a*$/, false],
        [/[\w]+a*$/, false],
        [/[\w]+[^\w]a*$/, true],
        [/[\w]+(b|[^\w])a*$/, false],
        [/([\w]|[^\w])+a*$/, false],
        [/([a]|[^a])+b*$/, false],
        [/([a]|[^a])+ab*$/, false],
        [/([a]|[^a])+$/, true],
        [/([a-d]|[b-f])+$/, false],
        [/([a-d]|[b-f])+c*$/, false],
        [/(|a){0,2}$/, false],
        [/(a|){0,2}$/, false],
        [/(a|b?){0,2}$/, false],
        [/([a-d]|)+e*$/, false],
        [/(|[a-d])+e*$/, false],
        [/(a|(b|))+$/, false],
        [/((?=b)|a){0,2}$/, false],
        [/(a(?=b)|a){0,2}$/, false],
        [/(a|b|c)*d*$/, true],
        [/(a|b*|c)b(a|b+|c)$/, false],
        [/(a|b*|c)+$/, false],
        [/(a|b*)+$/, false],
        [/(a|b*)$/, true],
        [/(a|b+|c)+$/, false],
        [/(a|b{1,3}|c)+$/, false],
        [/a+a{0,3}$/, false],
        [/(a|b|c)+$/, true],
        [/(a|bc*)+$/, true],
        [/(a)+b(\1)+$/, true],
        [/(a)b(\1)?a?$/, false],
        [/(z)ba?\1a?$/, true],
        [/(z?)ba?\1a?$/, false],
        [/(a)+b\1+$/, true],
        [/(a)+a(\1)+$/, false],
        [/(a)+(\1)+$/, false],
        [/(a+a+)$/, false],
        [/((a?)b\1a+)$/, true],
        [/((a?)b\2a+)$/, true],
        [/((a?)\2)$/, true],
        [/(a?)a\1$/, false],
        [/(a?)b\1a?$/, true],
        [/(a?)b\1?$/, true],
        [/((a{1,2})\1)$/, true],
        [/((a+)\1)$/, true],
        [/((a+)a+)$/, false],
        [/a+\99$/, true],
        [/(a+)b\1$/, true],
        [/(a+)b\1+a+$/, false],
        [/(a+)b\1+a?$/, false],
        [/(a+)b\1+a{1,2}$/, false],
        [/(a+)b\1+a{0,2}$/, false],
        [/(a?)b\1+a?$/, false],
        [/(a)b\1+a?$/, false],
        [/(a+)b\1+a*$/, false],
        [/(a?)\1$/, true],
        [/(a?)\1+$/, true],
        [/(a?)\1+\1+$/, false],
        [/(a+)(b+)\1\2$/, true],
        [/(a+)(b+\1)\1\2$/, false],
        [/(a{1,2})(b{1,2}\1)\1\2$/, true],
        [/(a+)(b+\1)\1$/, false],
        [/(a+)(b*\1)\1$/, false],
        [/(a+)(b+)\1\1$/, false],
        [/(a+)(b*)\1\1$/, false],
        [/(?:a)(b)a\1+b+$/, false],
        [/(a+)\1a+$/, false],
        [/((a{0,2})\2a{0,2})$/, false],
        [/((a{0,2})\2a{0,2})\1$/, false],
        [/((a)\2)\1b?b?$/, false],
        [/(a)b\1?a?$/, false],
        [/(a){0}b\1?a?$/, true],
        [/(a){1}b\1?a?$/, false],
        [/(a){0,1}b\1?a?$/, false],
        [/((a)){0}b\2?a?$/, true],
        [/(a){0,1}b\1?a?$/, false],
        [/(a){0,1}bc?\1c?$/, false],
        [/(a){1}bc?\1c?$/, true],
        [/(a){0}bc?\1c?$/, false],
        [/(a)|\1?a?$/, false],
        [/b|(a)b\1?a?$/, false],
        [/(a)|(c|\1?a?)$/, false],
        [/c|d|((a)b\2?a?)$/, false],
        [/c|d|((a)b\2?a?){0}$/, true],
        [/(c|d|(a)b\2?a?){0}$/, true],
        [/(c|d|(a)b\2?a?){0,1}$/, false],
        [/((a)|b)cd?\2d?$/, false],
        [/((a)|b)c\2?a?$/, false],
        [/((a){1,2}b\2\2)*a*$/, false],
        [/((a)b\2b\2b)*(ab){0,1}$/, false],
        [/((a)?\2b)*a*$/, false],
        [/((a)\2b)*(aab)?$/, false],
        [/(a)(\1a|\1b)*(aa)?$/, false],
        [/(a)(\1a|\1b)*(a\1)?$/, false],
        [/a(b)|c\1?b?$/, true],
        [/a(b)|c?\1c?$/, false],
        [/a(b)?c?\1c?$/, false],
        [/(a\1?a)$/, true],
        [/(a?\1a?)$/, false],
        [/(b)(a?\1a?)$/, true],
        [/(ab?c)*ab(cabcab)?c$/, false],
        [/(ab?c)*ab(cacab)?$/, false],
        [/(ab?c)*ab(cabca)?$/, false],
        [/(ab?c)*ab(cabcab)?$/, false],
        [/(ab?c)*a(cabca)?$/, false],
        [/(ab?c)*a(cabcab)?$/, false],
        [/(ab?c)*a(cabcab)?c$/, false],
        [/(ab?c)*a(bcabcab){1,2}/, false],
        [/(abc)*a(bcabcabca){0,1}$/, false],
        [/(ab?c)*a(bcabca){0,1}$/, false],
        [/(a?bc)*(abca){0,1}$/, false],
        [/(a?bc)*(bca){0,1}$/, false],
        [/(a?bc)*(bc){0,1}$/, false],
        [/(ab?c)*a(bca){0,1}$/, false],
        [/(ab?c)*a(ca){0,1}c$/, false],
        [/(ab?c)*a(cab){0,1}c$/, false],
        [/(ab?c)*ab(cab){0,1}c$/, false],
        [/(ab?c)*ab(ca){0,1}c$/, false],
        [/(abc)*a(bca){0,1}bc$/, false],
        [/(abc)*a(bc){0,1}abc$/, false],
        [/(ab?c)*a(bcabcab){0,1}$/, false],
        [/(ab?c)*a(cabcab){0,1}$/, false],
        [/(ab?c)*a(cabca){0,1}$/, false],
        [/(ab?c)*a(cabcab?){0,1}$/, false],
        [/(abc)*a(bcabcab){0,1}$/, false],
        [/a|a/, true],
        [/(a|a)$/, false],
        [/(.|a)$/, false],
        [/(ab|a.)$/, false],
        [/(a|)$/, true],
        [/(|a)$/, true],
        [/(a{0}|a)$/, true],
        [/(a?|a)$/, false],
        [/(ab|a)$/, false],
        [/(a|ab)$/, false],
        [/(ac|ab)$/, false],
        [/(|)$/, true],
        [/(()|())$/, true],
        [/(a?|b?)$/, true],
        [/([a-c]|[d-f])$/, true],
        [/([a-c]|[c-f])$/, false],
        [/(aa|a{2})$/, false],
        [/(ab|a(b|c))$/, false],
        [/(a(b|x)c)?ab(ca(b|x))?$/, false],
        [/[a]?[^b]?$/, false],
        [/[^a]?[^b]?$/, false],
        [/a+(?=(a))\1+$/, false],
        [/a+(?=(b))\1a+$/, true],
        [/a+(?=(b)?)\1a+v/, false],
        [/(?=a+(?=a+))$/, true],
        [/(?=a+(?=a+)a+)$/, false],
        [/a+(?=(a))$/, true],
        [/a+(?=(a))\1+$/, false],
        [/a+(?=(a{0}))\1+$/, true],
        [/(?=(b))a+\1a+$/, true],
        [/(?=(b)?)a+\1a+$/, false],
        [/a+(?=a+)$/, true],
        [/a+(?=a+a+)$/, false],
        [/a(?=a+a+)$/, false],
        [/(b)(?=a+\1a+)$/, true],
        [/(?=(b))a+\1a+$/, true],
        [/(?=(b)?)a+\1a+$/, false],
        [/a?(?=a?)$/, true],
        [/a(?=b{1,2})b$/, true],
        [/a(b)(?=b{1,2})\1$/, true],
        [/(?=(aa){1,2}(a\2){1,2})$/, false],
        [/(?=(a){1,2}(a\2){1,2})$/, false],
        [/a(?=((?=(b+\1+))))$/, true],
        [/a(?=(b(?=(b+\1+))))$/, true],
        [/a(?=(b)(?=(b+\1+)))$/, false],
        [/(?=(a(?=(b+\1b+))))$/, false],
        [/(?=((?=(b+\1b+))))$/, false],
        [/a(?=(b)(?=(b+\1+)))$/, false],
        [/a(?!a+a+)$/, false],
        [/a(?<=a+a+)$/, false],
        [/(b)(?<=a+\1a+)$/, true],
        [/(?<=a+\1a+)(b)$/, false],
        [/(?<=(b))a+\1a+$/, true],
        [/(?<=(b)?)a+\1a+$/, false],
        [/(?<=(a))(a\1)?(aa)?$/, false],
        [/a(?<!a+a+)$/, false],
        [/a(?<=a+)a+$/, true],
        [/(a+\b)+$/, false],
        [/(a+\B)+$/, false],
        [/a|a\B|a\b$/, false],
        [/(^a\b\B$)+.{10}$/, true],
        [/(ab)?(ab)?$/, false],
        [/(ab)?a?b?$/, false],
        [/(abc)?a?b?c?$/, false],
        [/(ab)?a+b+$/, false],
        [/(ab)?a*b*$/, false],
        [/(ab)?(a*|z)b*$/, false],
        [/((aa)*b)*(a?(a|b))*$/, false],
        [/(a(aa)*b)*aa((a|b)baa)*$/, false],
        [/[a-\d]+-+$/, false],
        [/(([01][0-9]|[012][0-3]):([0-5][0-9]))$/, false],
        [/(([01][0-9]|[2][0-3]):([0-5][0-9]))$/, true],
        [/([\d\w][-\d\w]{0,253}[\d\w]\.)+$/, false],
        [/([^\x00]{0,220}\x00)*$/, true],
        [/([^\x00]{0,2}\x00)*$/, true],
        [/(a|b)*[^c].*$/, false],
        [/(a|b|ab)*c$/, false],
        [/(a|b|ab){0,4}c$/, false],
        [/((a|b|ab)c?)?$/, false],
        [/((a|b|ab)c?){1,2}$/, false],
        [/((a|ab)b?)+$/, false],
        [/(a|ab)$/, false],
        [/(a|a)$/, false],
        [/((a|ab)b?c)+$/, false],
        [/(a|b|c|ab|bc)*a.*$/, false],
        [/(a|b)$/, true],
        [/(a|b|ab)$/, false],
        [/(a|b|ab)?$/, false],
        [/(a|b|ab)+$/, false],
        [/(a|b|ab)*$/, false],
        [/(a|b|ab|)*$/, false],
        [/(a|b|ab|){0,4}$/, false],
        [/(a|)*$/, false],
        [/(a*b|a*c)*$/, false],
        [/(a*b|a*b)$/, false],
        [/(a|b|aabb){0,4}$/, false],
        [/(a|b|aabb)*$/, false],
        [/(a|b|abab)*$/, false],
        [/(aa|bb|aabb)*$/, false],
        [/(bb|aa|aabb)*$/, false],
        [/(bb|aa|aabbz|z)*$/, false],
        [/(a{1,2}|aa)*$/, false],
        [/👍+👍+$/, true],
        [/(👍)+(👍)+$/, 'noIgnoreSnapshot'],
        [/👍+\udc4d+$/, 'noIgnoreSnapshot'],
        [/👍+👍+$/u, false],
        [/\u{1f44d}+\u{1f44d}+$/u, false],
        [/\u{1f44d}+\u{1f44d}+$/, true],
        [/a+\u{61}+$/u, false],
        [/\p{L}+a+$/u, false],
        [/\p{L}+\P{Number}a+$/u, false],
        [/[\p{L}]+a+$/u, false],
        [/a{0,9007199254740991}a+$/, false],
        [/a{0,-1}a+$/, true],
        [/(abab)?(ababab)?(ab)?$/, false],
        [/((?::a+)?)(a*)?$/, false],
        [/((?:a+:)?)(a*)?$/, false],
        [/^a?a*$/, false],
        [/((?:a+:)?)([^b]*)?$/, false],
        [/((?:a+:)?)([^b:]*)?$/, false],
        [/b?(bc)?c?$/, false],
        [/b?c?(bc)?$/, false],
        [/(bc)?b?c?$/, false],
        [/b?c?|(bc)?$/, false],
        [/(aaa)?a{4,5}$/, false],
        [/a$a+a+$/, true],
        [/a($|)a+a+$/, false],
        [/a($|)a+a+$/, false],
        [/a+a+^a$/, false],
        [/a+a+(^|)a$/, false],
        [/(a{252,253}){1,}$/, 'noIgnoreSnapshot'],
        [/(a{252,253}){1,2}$/, 'noIgnoreSnapshot'],
        [/(a{2,3}){1,}$/, false],
        [/((aa)|(aaa)){1,3}$/, false],
        [/((aa)|(aaa)){1,}$/, false],
        [/(a{1000,}b)+(a{999,}c)+$/, 'noIgnoreSnapshot'],
        [/(a{1,2}a{1,2})*$/, false],
        [/(?:(?:c|(a))){2}ac\1?a?$/, false],
        [/(?:(?:c|(a))){2}ca\1?a?$/, false],
        // abababba
        [/(?:(a)?b){2}abb\1?a?$/, false],
        // ababbaba
        [/(?:(a)?b){2}bab\1?a?$/, false],
        [/(?:(a)?){2}b\1?a?$/, false],
        // aaaabaaaa
        [/(a*)b\1?(aaaa)?$/, false],
        [/(a{4})b\1?(aaaa)?$/, false],
        [/(aa{3})b\1?(aaaa)?$/, false],
        [/(){2}a?a?$/, false],
        [/(?:(a?){2}x\1)?(axa)?$/, false],
        [/(?:(a?){2}x\1)?(ax)?$/, false],
        [/(?:(a?){2}x\1)?a?$/, false],
        [/(?:a?(a?)x\1)?a?$/, false],
        [/(a?){2}$/, false],
        [/(a+b\1)$/, true],
        [/(xx)?(xx||)$/, false],
        [/(^)*$/, true],
        [/($)*$/, true],
        [/a+a+(^)+a$/, false],
        [/a+a+(^)*a$/, false],
        [/(?=a)^a+a+$/, false],
        [/($)+a+a+$/, true],
        [/($)*a+a+$/, false],
        [/b(a)?^\1?a?$/, true],
        [/b(a)?^(a\1)(aa)?$/, true],
        [/(a)?^\1?a?$/, true],
        [/(?=(a?)b)\1a?$/, false],
        [/.?[a-z]?$/, false],
        [/.?[^a-z]?$/, false],
        [/(a)(\1)(\2)x\3?(a)?$/, false],
        [/a(?!(a))\1$/, true],
        [/a(?!(b(?=(c))))xc?\2?$/, true],
        [/(a?)a?x\1$/, false],
        [/(a+b)?(a+c)$/, false],
        [/(a+b)?(a+c)$/, false],
        [/^(?=((?=(a*))\2.*))\1a*$/, true],
        [/(a(?=b+))*^\1?a*$/, true],
        [/(a(?!b+))*^\1?a*$/, true],
        [/(a(?<=b+))*^\1?a*$/, true],
        [/(a(?<!b+))*^\1?a*$/, true],
        [/(?=a?a?)/, true],
        [/(?=a?a?$)/, false],
        [/(a)(\1)\2?a?$/, false],
        [/(a)(\1)(\2)\3?a?$/, false],
        [/($)\1/, true],
        [/^(a)\1?\1?$/, false],
        [/(^a)\1?\1?$/, true],

        // atomic group workaround detected
        [/(?=(a{0,1}))\1a?$/, true],
        [/(?=(a?))\1a?$/, true],
        [/(?=(a?b))\1a?$/, true],
        [/a?(?=(a{0,1}))\1$/, true],
        [/(?=(a?a?))\1a$/, false],

        // atomic group workaround not detected because group not entire lookahead
        [/(?=(a{0,1})b)\1a?$/, false],
        [/(?=(a{0,1})b)\1a?$/, false],

        // case insensitive
        [/[a-z]?[A-Z]?$/i, false],
        [/a?A?$/i, false],
        [/[E-c]?d?$/i, true],
        [/[E-c]?e?$/i, false],
        [/[^a]?A?$/i, true],

        // dotAll
        [/.?[\r\n\u2028-\u2029].?$/, true],
        [/.?[\r\n\u2028-\u2029].?$/s, false],

        // character class escape expansions
        [/.?a?$/, false],
        [/.?[\n\r\u2028\u2029]?$/, true],
        [/.?[\n\r\u2028\u2029]?$/, true],
        [/\d?[^0-9]?$/, true],
        [/\d?[0-9]?$/, false],
        [/\D?[0-9]?$/, true],
        [/\D?[^0-9]?$/, false],
        [/\w?[^A-Za-z0-9_]?$/, true],
        [/\w?[A-Za-z0-9_]?$/, false],
        [/\W?[A-Za-z0-9_]?$/, true],
        [/\W?[^A-Za-z0-9_]?$/, false],
        [
          /\s?[^\f\n\r\t\v\u0020\u00a0\u1680\u2000-\u200a\u2028-\u2029\u202f\u205f\u3000\ufeff]?$/,
          true,
        ],
        [
          /\s?[\f\n\r\t\v\u0020\u00a0\u1680\u2000-\u200a\u2028-\u2029\u202f\u205f\u3000\ufeff]?$/,
          false,
        ],
        [
          /\S?[\f\n\r\t\v\u0020\u00a0\u1680\u2000-\u200a\u2028-\u2029\u202f\u205f\u3000\ufeff]?$/,
          true,
        ],
        [
          /\S?[^\f\n\r\t\v\u0020\u00a0\u1680\u2000-\u200a\u2028-\u2029\u202f\u205f\u3000\ufeff]?$/,
          false,
        ],
        [/.?[\n\r\u2028-\u2029]?$/, true],
        [/.?[^\n\r\u2028-\u2029]?$/, false],
      ];

      cases.forEach(([regex, expectNoBacktracks]) => {
        const source =
          typeof regex === 'string' ? regex : `/${regex.source}/${regex.flags}`;

        it(source, () => {
          const result = isSafe(regex, {
            maxBacktracks: Infinity,
            maxSteps: 5000,
          });
          const { error, trails, safe, worstCaseBacktrackCount } = result;

          if (expectNoBacktracks === true) {
            expect(error).toBe(null);
          }
          expect(error).toMatchSnapshot();

          expect(trails.length === 0).toBe(expectNoBacktracks === true);
          if (expectNoBacktracks === true) {
            expect(worstCaseBacktrackCount).toStrictEqual({
              infinite: false,
              value: 0,
            });
          } else {
            expect(worstCaseBacktrackCount).toMatchSnapshot();
          }
          expect(safe).toBe(!error);

          if (expectNoBacktracks !== 'noIgnoreSnapshot') {
            expect(
              trails.map((trail) => {
                return {
                  ...trail,
                  trail: trail.trail.map((trailEntry) => {
                    return {
                      ...trailEntry,
                      a: { ...trailEntry.a, quantifierIterations: 'removed' },
                      b: { ...trailEntry.b, quantifierIterations: 'removed' },
                    };
                  }),
                };
              }),
            ).toMatchSnapshot();
            expect(toFriendly(result)).toMatchSnapshot();
          }

          const neededDowngrade =
            downgradePattern({
              pattern: regex.source,
              unicode: regex.flags.indexOf('u') >= 0,
            }).pattern !== regex.source;

          if (neededDowngrade) {
            expect(() =>
              isSafe(regex, { downgradePattern: false }),
            ).toThrowError(
              /^(Unsupported reference \(\d+ at position \d+\)\. Pattern needs downgrading\. See the `downgradePattern` option\.|Unsupported reference to group \d+ as group is not a finite size\. Pattern needs downgrading\. See the `downgradePattern` option\.)$/,
            );
          }
        });
      });
    });

    it('respects the `maxBacktracks`', () => {
      expect(
        isSafe(/a?a?$/, {
          maxBacktracks: 1,
        }).error,
      ).toBe(null);
      expect(
        isSafe(/a?a?$/, {
          maxBacktracks: 0,
        }).error,
      ).toBe('hitMaxBacktracks');
      expect(
        isSafe(/a*a*$/, {
          maxBacktracks: Infinity,
        }).error,
      ).toBe('hitMaxBacktracks');
    });

    it('respects the timeout', () => {
      let fakeTime = 0;
      const spy = jest.spyOn(Date, 'now');
      spy.mockImplementation(() => {
        fakeTime++;
        return fakeTime;
      });
      const res = isSafe(/a?a?a?/, {
        timeout: 20,
      });
      expect(res.error).toBe('timedOut');
      expect(res).toMatchSnapshot();
    });

    it('respects the `maxSteps`', () => {
      const res = isSafe(/a?a?a?/, {
        maxSteps: 20,
      });
      expect(res.error).toBe('hitMaxSteps');
      expect(res).toMatchSnapshot();
    });

    it('throws if `maxBacktracks` not positive or 0', () => {
      expect(() =>
        isSafe(/a/, {
          maxBacktracks: -1,
        }),
      ).toThrowError('`maxBacktracks` must be a positive number or 0.');
    });

    it('throws if `timeout` not positive', () => {
      expect(() =>
        isSafe(/a/, {
          timeout: 0,
        }),
      ).toThrowError('`timeout` must be a positive number.');
    });

    it('throws if `maxSteps` not positive', () => {
      expect(() =>
        isSafe(/a/, {
          maxSteps: 0,
        }),
      ).toThrowError('`maxSteps` must be a positive number.');
    });

    it('throws if an unsupported flag is passed', () => {
      expect(() => isSafe(/a/m)).toThrowError('Unsupported flag: m');
    });

    ['u', 'g', 's', 'y', 'i', 'd'].forEach((flag) => {
      it(`supports the "${flag}" flag`, () => {
        expect(() => isSafe(new RegExp('a', flag))).not.toThrowError();
      });
    });

    it('throws if `caseInsensitive` used with `unicode`', () => {
      expect(() =>
        isSafePattern(`a`, { caseInsensitive: true, unicode: true }),
      ).toThrowError('`caseInsensitive` cannot be used with `unicode`.');
    });

    it('throws if the number of loops is above max safe integer', () => {
      expect(() =>
        isSafePattern(`a{0,${Number.MAX_SAFE_INTEGER + 1}}`),
      ).toThrowError('iterations outside JS safe integer range');
    });

    it('throws if `downgradePattern` used with `atomicGroupOffsets`', () => {
      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        isSafePattern('', {
          atomicGroupOffsets: new Set<number>(),
          downgradePattern: true,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
      }).toThrowError(
        '`atomicGroupOffsets` cannot be used with `downgradePattern: true`.',
      );
    });

    it('supports `atomicGroupOffsets`', () => {
      expect(
        isSafePattern('(a?)a?$', {
          atomicGroupOffsets: new Set([0]),
          downgradePattern: false,
        }).trails,
      ).toHaveLength(0);
    });
  });

  describe('isSafePattern', () => {
    it('supports no options', () => {
      expect(isSafePattern('a').error).toBe(null);
    });
  });

  describe('downgradePattern', () => {
    it('is exported', () => {
      expect(downgradePattern).toBeTruthy();
    });
  });
});
