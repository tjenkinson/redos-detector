export class ResultCache<TValue, TKey = unknown> {
  private _cache: Map<TKey, Map<TKey, TValue>> = new Map();

  public addResult(a: TKey, b: TKey, result: TValue): void {
    const mapA = this._cache.get(a) || new Map<TKey, TValue>();
    mapA.set(b, result);
    this._cache.set(a, mapA);

    const mapB = this._cache.get(b) || new Map<TKey, TValue>();
    mapB.set(a, result);
    this._cache.set(b, mapB);
  }

  public getResult(a: TKey, b: TKey): TValue | undefined {
    return this._cache.get(a)?.get(b);
  }
}
