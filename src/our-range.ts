export type OurRange = readonly [number, number];

export type RangeIntersection = Readonly<{
  a: readonly OurRange[];
  b: readonly OurRange[];
  shared: OurRange;
}>;

export function subtractRanges(
  source: OurRange,
  toSubtract: OurRange,
): readonly OurRange[] {
  const res: OurRange[] = [];
  if (source[0] < toSubtract[0]) {
    res.push([source[0], Math.min(toSubtract[0] - 1, source[1])]);
  }
  if (source[1] > toSubtract[1]) {
    res.push([Math.max(toSubtract[1] + 1, source[0]), source[1]]);
  }
  return res;
}

export function intersectRanges(
  a: OurRange,
  b: OurRange,
): RangeIntersection | null {
  const startShared = Math.max(a[0], b[0]);
  const endShared = Math.min(a[1], b[1]);
  if (startShared > endShared) {
    return null;
  }

  const shared: OurRange = [startShared, endShared];
  return {
    a: subtractRanges(a, shared),
    b: subtractRanges(b, shared),
    shared,
  };
}

export function createRanges(set: Set<number>): OurRange[] {
  const ascending = [...set].sort((a, b) => a - b);

  const ranges: OurRange[] = [];
  let startIndex = 0;

  for (let i = 0; i < ascending.length; i++) {
    const startValue = ascending[startIndex];
    const currentValue = ascending[i];
    const nextValue = i + 1 < ascending.length ? ascending[i + 1] : null;

    if (nextValue === null || nextValue - startValue !== i - startIndex + 1) {
      ranges.push([startValue, currentValue]);
      startIndex = i + 1;
    }
  }

  return ranges;
}
