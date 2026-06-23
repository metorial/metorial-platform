import { deepEquals } from 'bun';

export let matchesUpdate = <T>(existing: T, update: Partial<T>) => {
  for (let key in update) {
    if (update[key] !== existing[key]) {
      if (
        Array.isArray(update[key]) &&
        Array.isArray(existing[key]) &&
        update[key].length === existing[key].length &&
        JSON.stringify(update[key].sort()) === JSON.stringify(existing[key].sort())
      ) {
        continue;
      }

      if (
        typeof update[key] === 'object' &&
        typeof existing[key] === 'object' &&
        deepEquals(update[key], existing[key])
      ) {
        continue;
      }

      return false;
    }
  }

  return true;
};
