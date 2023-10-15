export type OurRange = readonly [number, number];

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

export function intersectRanges(a: OurRange, b: OurRange): OurRange | null {
  const startShared = Math.max(a[0], b[0]);
  const endShared = Math.min(a[1], b[1]);
  if (startShared > endShared) {
    return null;
  }

  return [startShared, endShared];
}

export function createRanges(set: ReadonlySet<number>): readonly OurRange[] {
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

/* note input ranges must be sorted and not overlap */
export function invertRanges(ranges: readonly OurRange[]): readonly OurRange[] {
  const result: OurRange[] = [];

  for (let i = 0; i < ranges.length + 1; i++) {
    const prev = i - 1 >= 0 ? ranges[i - 1] : null;
    const current = i < ranges.length ? ranges[i] : null;

    const start = prev ? prev[1] + 1 : -Infinity;
    const end = current ? current[0] - 1 : +Infinity;
    if (start - end === 1) continue;
    if (start > end) throw new Error('Internal error: invalid ranges input');

    result.push([start, end]);
  }

  return result;
}
