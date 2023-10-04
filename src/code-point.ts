import { createRanges, OurRange } from './our-range';

export function toCodePoint(input: string): number {
  const codePoint = input.codePointAt(0);
  /* istanbul ignore next */
  if (!codePoint) throw new Error('Internal error: expected codepoint');
  return codePoint;
}

export function toLowerCaseCodePoint(codePoint: number): number {
  return toCodePoint(String.fromCodePoint(codePoint).toLowerCase());
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
    codePoints.add(toLowerCaseCodePoint(codePoint));
  }

  return createRanges(codePoints);
}
