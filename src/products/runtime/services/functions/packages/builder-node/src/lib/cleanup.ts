export let cleanup = <T>(arr: (T | null | undefined)[]): T[] =>
  arr.filter((item): item is T => item != null);
