export type Entry<T> = Readonly<{ left: T; right: T }>;

export class InfiniteLoopTracker<T> {
  private readonly _history: Array<Entry<T>> = [];

  private _isEntryEqual(a: Entry<T>, b: Entry<T>): boolean {
    return this._isEqual(a.left, b.left) && this._isEqual(a.right, b.right);
  }

  private readonly _isEqual: (left: T, right: T) => boolean;

  public append(entry: Entry<T>): void {
    this._history.push(entry);
  }

  public clone(): InfiniteLoopTracker<T> {
    return new InfiniteLoopTracker(this._isEqual, this);
  }

  constructor(
    isEqual: (left: T, right: T) => boolean,
    source?: InfiniteLoopTracker<T>,
  ) {
    this._isEqual = isEqual;
    if (source) {
      this._history = [...source.getHistory()];
    }
  }

  public getHistory(): ReadonlyArray<Entry<T>> {
    return [...this._history];
  }

  public getRepeatingEntries(): ReadonlyArray<Entry<T>> | null {
    const length = this._history.length;
    outer: for (
      let candidateSize = 1;
      candidateSize <= length / 2;
      candidateSize++
    ) {
      const candidateStart = length - candidateSize * 2;
      for (let i = 0; i < candidateSize; i++) {
        if (
          !this._isEntryEqual(
            this._history[candidateStart + i],
            this._history[candidateStart + candidateSize + i],
          )
        ) {
          continue outer;
        }
      }
      return this._history.slice(
        candidateStart,
        candidateStart + candidateSize,
      );
    }
    return null;
  }
}
