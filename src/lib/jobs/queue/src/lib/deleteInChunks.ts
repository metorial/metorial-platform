export let deleteInChunks = async <Key>(d: {
  chunkSize: number;
  maxChunks?: number;
  selectKeys: (chunkSize: number) => Promise<Key[]>;
  deleteKeys: (keys: Key[]) => Promise<unknown>;
}): Promise<{ deleted: number; hasMore: boolean }> => {
  let maxChunks = d.maxChunks ?? 20;
  let deleted = 0;

  for (let chunk = 0; chunk < maxChunks; chunk++) {
    let keys = await d.selectKeys(d.chunkSize);
    if (!keys.length) return { deleted, hasMore: false };

    await d.deleteKeys(keys);
    deleted += keys.length;

    if (keys.length < d.chunkSize) return { deleted, hasMore: false };
  }

  return { deleted, hasMore: true };
};
