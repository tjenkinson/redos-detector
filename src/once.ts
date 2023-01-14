export function once<T>(fn: () => T): () => T {
  let done = false;
  let res: T;
  return (): T => {
    if (!done) {
      done = true;
      res = fn();
    }
    return res;
  };
}
