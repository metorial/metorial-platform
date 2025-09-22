import { deepEquals } from 'bun';

export let checkObjectMatch =
  <A extends {}, B extends {}>(a: A, b: B) =>
  (checks: (keyof A & keyof B)[]) => {
    for (let key of checks) {
      if (a[key] === undefined) continue;

      if (Array.isArray(a[key]) && Array.isArray(b[key])) {
        if (a[key].length !== b[key].length) return false;
        let aSorted = [...(a[key] as any[])].sort();
        let bSorted = [...(b[key] as any[])].sort();
        for (let i = 0; i < aSorted.length; i++) {
          if (aSorted[i] !== bSorted[i]) return false;
        }
        continue;
      }

      if (a[key] instanceof Date && b[key] instanceof Date) {
        if (a[key].getTime() !== b[key].getTime()) return false;
        continue;
      }

      if (typeof a[key] === 'object' && typeof b[key] === 'object') {
        if (!deepEquals(a[key], b[key])) return false;
        continue;
      }

      // @ts-ignore
      if (a[key] != b[key]) return false;
    }
    return true;
  };
