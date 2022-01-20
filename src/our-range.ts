export type OurRange = readonly [number, number];

export type RangeIntersection = Readonly<{
  a: readonly OurRange[];
  b: readonly OurRange[];
  shared: OurRange;
}>;

export function subtractRanges(
  source: OurRange,
  toSubtract: OurRange
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
  b: OurRange
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
