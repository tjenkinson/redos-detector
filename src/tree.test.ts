import { Tree } from './tree';

describe('tree', () => {
  it('works', () => {
    const a = Symbol('a');
    const b = Symbol('b');
    const c = Symbol('c');
    const tree = new Tree<unknown[]>((x) => x);
    expect(tree.items).toStrictEqual([]);

    tree.add([]);
    expect(tree.items).toStrictEqual([]);

    tree.add([a]);
    expect(tree.items).toStrictEqual([[a]]);

    tree.add([a]);
    expect(tree.items).toStrictEqual([[a]]);

    tree.add([b]);
    expect(tree.items).toStrictEqual([[a], [b]]);

    tree.add([a, b]);
    expect(tree.items).toStrictEqual([[b], [a, b]]);

    tree.add([a, c]);
    expect(tree.items).toStrictEqual([[b], [a, b], [a, c]]);
  });

  it('works with decoder', () => {
    const a = Symbol('a');
    const b = Symbol('b');
    const tree = new Tree<{ v: symbol[] }>((x) => x.v);
    expect(tree.items).toStrictEqual([]);

    const v1 = { v: [a] };
    tree.add(v1);
    expect(tree.items).toStrictEqual([v1]);

    tree.add(v1);
    expect(tree.items).toStrictEqual([v1]);

    const v2 = { v: [b] };
    tree.add(v2);
    expect(tree.items).toStrictEqual([v1, v2]);

    const v3 = { v: [a, b] };
    tree.add(v3);
    expect(tree.items).toStrictEqual([v2, v3]);
  });
});
