import { once } from './once';

type TreeItem = {
  children: Map<unknown, TreeItem>;
  value: unknown;
};

const rootSymbol = Symbol('root');
export class Tree<T> {
  private root: Map<unknown, TreeItem> = new Map();
  private results: Map<TreeItem, T> = new Map();
  private _items: () => readonly T[] = () => [];

  constructor(private decode: (value: T) => readonly unknown[]) {}

  public add(input: T): void {
    const values = this.decode(input);
    if (values.length === 0) return;

    const { results } = this;
    let current: TreeItem = {
      children: this.root,
      value: rootSymbol,
    };

    // note initially used `.entries()` but this was much slower
    const numValues = values.length;
    for (let i = 0; i < numValues; i++) {
      const value = values[i];
      const last = i === numValues - 1;
      const existing = current.children.get(value);
      if (existing) {
        current = existing;
        if (!last) {
          results.delete(existing);
        }
      } else {
        const newChild: TreeItem = { children: new Map(), value };
        current.children.set(value, newChild);
        current = newChild;
        if (last) {
          results.set(newChild, input);
        }
      }
    }

    this._items = once(() => Array.from(results.values()));
  }

  public get items(): readonly T[] {
    return this._items();
  }
}
