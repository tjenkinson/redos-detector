export function last<T>(input: readonly T[]): T | null {
  const { length } = input;
  return length ? input[length - 1] : null;
}

export function areArraysEqual<T>(a: readonly T[], b: readonly T[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((value, i) => value === b[i]);
}

export function dropCommon<T>(
  a: readonly T[],
  b: readonly T[]
): { a: readonly T[]; b: readonly T[] } {
  let commonLevels: number;
  for (
    commonLevels = 0;
    commonLevels < a.length &&
    commonLevels < b.length &&
    a[commonLevels] === b[commonLevels];
    commonLevels++
  );

  return {
    a: a.slice(commonLevels),
    b: b.slice(commonLevels),
  };
}
