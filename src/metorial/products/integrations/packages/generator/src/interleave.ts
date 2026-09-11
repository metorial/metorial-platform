type AsyncValue<T> = T extends AsyncIterable<infer U> ? U : never;

type InterleaveResult<T extends readonly AsyncIterable<any>[]> = {
  [K in keyof T]: AsyncValue<T[K]> | undefined;
};

export async function* interleave<T extends readonly AsyncIterable<any>[]>(
  ...iterables: T
): AsyncGenerator<AsyncValue<T[number]>, InterleaveResult<T>> {
  let iterators = iterables.map(iterable => iterable[Symbol.asyncIterator]());

  let results = [] as unknown as InterleaveResult<T>;
  let remaining = iterators.length;

  let never = new Promise<never>(() => {});

  let getNext = (
    iterator: AsyncIterator<any>,
    index: number
  ): Promise<{
    index: number;
    result: IteratorResult<any>;
  }> => {
    return iterator.next().then(result => ({
      index,
      result
    }));
  };

  let nextPromises = iterators.map((it, index) => getNext(it, index));

  try {
    while (remaining > 0) {
      let { index, result } = await Promise.race(nextPromises);

      if (result.done) {
        nextPromises[index] = never;
        // @ts-expect-error
        results[index] = result.value;
        remaining--;
      } else {
        nextPromises[index] = getNext(iterators[index]!, index);
        yield result.value as AsyncValue<T[number]>;
      }
    }
  } finally {
    for (let index = 0; index < iterators.length; index++) {
      let iterator = iterators[index]!;
      if (nextPromises[index] !== never && iterator.return != null) {
        iterator.return();
      }
    }
  }

  return results;
}
