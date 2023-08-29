export function getOrCreate<TKey, TValue>(
  input: Map<TKey, TValue>,
  key: TKey,
  buildDefaultValue: () => TValue,
): TValue {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  if (input.has(key)) return input.get(key)!;

  const defaultValue = buildDefaultValue();
  input.set(key, defaultValue);
  return defaultValue;
}

export function areMapsEqual<K, V>(
  a: ReadonlyMap<K, V>,
  b: ReadonlyMap<K, V>,
): boolean {
  if (a.size !== b.size) return false;
  for (const [key, value] of a) {
    if (b.has(key) && b.get(key) !== value) {
      return false;
    }
  }
  return true;
}

export function mustGet<K, V>(map: ReadonlyMap<K, V>, key: K): V {
  if (!map.has(key)) {
    throw new Error('Internal error: map missing key');
  }
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return map.get(key)!;
}
