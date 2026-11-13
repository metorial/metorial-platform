let tails = new Map<string, Promise<unknown>>();

export let enqueueConfigWrite = <T>(key: string, task: () => Promise<T>): Promise<T> => {
  let result = (tails.get(key) ?? Promise.resolve()).catch(() => {}).then(task);

  let tail = result
    .catch(() => {})
    .finally(() => {
      if (tails.get(key) === tail) tails.delete(key);
    });
  tails.set(key, tail);

  return result;
};
