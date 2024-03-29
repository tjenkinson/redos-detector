export function mergeSets<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): Set<T> {
  return new Set([...a, ...b]);
}

export function areSetsEqual<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): boolean {
  return a.size === b.size && mergeSets(a, b).size === a.size;
}

export function subtractSets<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): Set<T> {
  const newSet = new Set(a);
  b.forEach((bEntry) => newSet.delete(bEntry));
  return newSet;
}

export function setsOverlap<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): boolean {
  const total = a.size + b.size;
  return new Set([...a, ...b]).size < total;
}
