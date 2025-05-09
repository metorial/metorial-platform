export let createProgrammableAsyncIterator = <Y, R>() => {
  let nextValueStack: { type: 'throw' | 'yield' | 'finish'; value: any }[] = [];
  let resolveNext: ((value: IteratorResult<Y, R>) => void) | null = null;
  let rejectNext: ((error: any) => void) | null = null;
  let ended = false;

  let iterator = {
    [Symbol.asyncIterator]() {
      return this;
    },

    async next(): Promise<IteratorResult<Y, R>> {
      let nextValue = nextValueStack.shift();
      if (nextValue) {
        if (nextValue.type == 'throw') throw nextValue.value;

        if (nextValue.type == 'finish') {
          return {
            value: nextValue.value,
            done: true
          } as IteratorResult<Y, R>;
        }

        return {
          value: nextValue.value,
          done: false
        } as IteratorResult<Y, R>;
      }

      return new Promise<IteratorResult<Y, R>>((resolve, reject) => {
        resolveNext = resolve;
        rejectNext = reject;
      });
    }
  };

  return {
    yield(value: Y) {
      if (ended) return;

      if (resolveNext) {
        resolveNext({ value, done: false });
        resolveNext = null;
      } else {
        nextValueStack.push({ type: 'yield', value });
      }
    },

    throw(error: Error) {
      if (ended) return;
      ended = true;

      if (rejectNext) {
        rejectNext(error);
        rejectNext = null;
      } else {
        nextValueStack.push({ type: 'throw', value: error });
      }
    },

    finish(value: R) {
      if (ended) return;
      ended = true;

      if (resolveNext) {
        resolveNext({ value, done: true });
        resolveNext = null;
      } else {
        nextValueStack.push({ type: 'finish', value });
      }
    },

    iterator
  };
};
