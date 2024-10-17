import { once } from './once';

/**
 * Note the decoded item must contain nodes, which only ever appear once,
 * and always appear in the same position.
 */
export class Tree<T> {
  // all nodes in the tree
  private nodes: Set<unknown> = new Set();
  private results: Map<unknown /* leaf node */, T> = new Map();
  private _items: () => readonly T[] = () => [];

  constructor(
    /* Decode `value` into the list of nodes */
    private decode: (value: T) => readonly unknown[],
  ) {}

  public add(input: T): void {
    const values = this.decode(input);
    if (values.length === 0) return;

    const { results, nodes } = this;

    const insert = (newValues: readonly unknown[]): void => {
      for (let i = 0; i < newValues.length; i++) {
        const value = newValues[i];
        nodes.add(value);
      }
    };

    for (let i = values.length - 1; i >= 0; i--) {
      const value = values[i];

      if (nodes.has(value)) {
        if (i === values.length - 1) {
          // this is just a subset of an item already in the tree
          return;
        }
        results.delete(value);
        insert(values.slice(i + 1));
        results.set(values[values.length - 1], input);
        break;
      }

      if (i === 0) {
        // new item
        insert(values);
        results.set(values[values.length - 1], input);
        break;
      }
    }

    this._items = once(() => Array.from(results.values()));
  }

  public get items(): readonly T[] {
    return this._items();
  }
}
