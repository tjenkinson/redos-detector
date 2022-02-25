export class ResultCache<T> {
  private _cache: Map<unknown, Map<unknown, T>> = new Map();

  public addResult(a: unknown, b: unknown, result: T): void {
    const mapA = this._cache.get(a) || new Map<unknown, T>();
    mapA.set(b, result);
    this._cache.set(a, mapA);

    const mapB = this._cache.get(b) || new Map<unknown, T>();
    mapB.set(a, result);
    this._cache.set(b, mapB);
  }

  public getResult(a: unknown, b: unknown): T | undefined {
    return this._cache.get(a)?.get(b);
  }
}
