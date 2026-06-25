export let autoPaginateMcp = async <T extends { nextCursor?: string | undefined | null }>(
  fn: (cursor?: string) => Promise<T>
): Promise<T[]> => {
  let results: T[] = [];
  let cursor: string | undefined = undefined;

  let i = 0;

  do {
    if (i++ > 100) break;

    let res = await fn(cursor);
    results.push(res);
    cursor = res.nextCursor ?? undefined;
  } while (cursor);

  return results;
};
