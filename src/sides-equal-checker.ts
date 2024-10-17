import { ResultCache } from './result-cache';
import { TrailEntrySide } from './checker-reader';

export class SidesEqualChecker {
  private _cache: ResultCache<boolean, TrailEntrySide> = new ResultCache();

  public areSidesEqual(left: TrailEntrySide, right: TrailEntrySide): boolean {
    const cached = this._cache.getResult(left, right);
    if (cached !== undefined) return cached;

    const equal =
      left.node === right.node && left.contextTrail === right.contextTrail;
    this._cache.addResult(left, right, equal);
    return equal;
  }
}
