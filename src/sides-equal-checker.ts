import { areArraysEqual } from './arrays';
import { areMapsEqual } from './map';
import { buildQuantifierIterations } from './nodes/quantifier';
import { ResultCache } from './result-cache';
import { TrailEntrySide } from './checker-reader';

export class SidesEqualChecker {
  private _cache: ResultCache<boolean, TrailEntrySide> = new ResultCache();

  public areSidesEqual(left: TrailEntrySide, right: TrailEntrySide): boolean {
    const cached = this._cache.getResult(left, right);
    if (cached !== undefined) return cached;

    const equal =
      left.node === right.node &&
      areArraysEqual(left.backreferenceStack, right.backreferenceStack) &&
      areMapsEqual(
        buildQuantifierIterations(left.quantifierStack),
        buildQuantifierIterations(right.quantifierStack),
      );
    this._cache.addResult(left, right, equal);
    return equal;
  }
}
