export class FoldedMap<K, I> {
  #store: Map<K, I[]> = new Map();

  constructor() {}

  put = (k: K, i: I): void => {
    let items = this.#store.get(k);

    if (!items) {
      items = [];
      this.#store.set(k, items);
    }

    items.push(i);
  };

  get = (k: K): I[] => {
    let items = this.#store.get(k);
    return items ? [...items] : [];
  };

  map = <R>(cb: (k: K, i: I[]) => R): R[] => {
    let result: R[] = [];

    for (let [k, items] of this.#store) {
      result.push(cb(k, items));
    }

    return result;
  };

  fold = (): [K, I[]][] => {
    let result: [K, I[]][] = [];

    for (let [k, items] of this.#store) {
      result.push([k, items]);
    }

    return result;
  };
}
