import { createRanges, OurRange } from './our-range';

export function toCodePoint(input: string): number | null {
  // https://tc39.es/ecma262/multipage/text-processing.html#sec-runtime-semantics-canonicalize-ch
  // step 7
  if (input.length > 1) return null;

  const codePoint = input.codePointAt(0);
  /* istanbul ignore next */
  if (!codePoint) throw new Error('Internal error: expected codepoint');
  return codePoint;
}

export function toUpperCaseCodePoint(codePoint: number): number {
  const upperCase = String.fromCodePoint(codePoint).toUpperCase();
  const upperCodePoint = toCodePoint(upperCase);
  return upperCodePoint !== null ? upperCodePoint : codePoint;
}

export function buildCodePointRanges({
  caseInsensitive,
  highCodePoint,
  lowCodePoint,
}: {
  caseInsensitive: boolean;
  highCodePoint: number;
  lowCodePoint: number;
}): OurRange[] {
  if (!caseInsensitive) {
    return [[lowCodePoint, highCodePoint]];
  }

  const codePoints: Set<number> = new Set();
  for (let codePoint = lowCodePoint; codePoint <= highCodePoint; codePoint++) {
    codePoints.add(toUpperCaseCodePoint(codePoint));
  }

  return createRanges(codePoints);
}
