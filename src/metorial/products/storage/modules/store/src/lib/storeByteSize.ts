import { withTransaction } from '@metorial/db';

/**
 * Sums the bytes of every file and document in a store.
 *
 * Documents keep their backing `File.fileSize` in sync on every content change,
 * so a single sum over `StoreItem.fileOid` covers both kinds. Directory items
 * carry no file, so they contribute nothing.
 */
export let computeStoreByteSize = async (d: { storeOid: bigint }): Promise<bigint> =>
  await withTransaction(
    async db => {
      let result = await db.file.aggregate({
        where: {
          storeItems: {
            some: {
              storeOid: d.storeOid
            }
          }
        },
        _sum: {
          fileSize: true
        }
      });

      return BigInt(result._sum.fileSize ?? 0);
    },
    { ifExists: true }
  );

/**
 * Recomputes the store's byte size and caches it on the store.
 *
 * This is the authoritative read. It is used wherever a limit is enforced,
 * because a cached value can lag: editing a document changes its file size
 * without touching any store item.
 */
export let refreshStoreByteSize = async (d: { storeOid: bigint }): Promise<bigint> =>
  await withTransaction(
    async db => {
      let byteSize = await computeStoreByteSize(d);

      await db.store.update({
        where: { oid: d.storeOid },
        data: { byteSize }
      });

      return byteSize;
    },
    { ifExists: true }
  );

/**
 * Reads the cached byte size, backfilling it on first use. Callers that need a
 * guaranteed-current value should use {@link refreshStoreByteSize} instead.
 */
export let getStoreByteSize = async (d: { storeOid: bigint }): Promise<bigint> =>
  await withTransaction(
    async db => {
      let store = await db.store.findUnique({
        where: { oid: d.storeOid },
        select: { byteSize: true }
      });

      if (store?.byteSize != null) return store.byteSize;

      return await refreshStoreByteSize(d);
    },
    { ifExists: true }
  );

/**
 * Keeps the cache warm after an item is added or removed. A null cache is left
 * alone: it means nobody has asked for the size yet, and the next read computes
 * it from scratch.
 */
export let applyStoreByteSizeDelta = async (d: { storeOid: bigint; delta: bigint }) => {
  if (d.delta === 0n) return;

  await withTransaction(
    async db => {
      await db.store.updateMany({
        where: {
          oid: d.storeOid,
          byteSize: { not: null }
        },
        data: {
          byteSize: { increment: d.delta }
        }
      });
    },
    { ifExists: true }
  );
};
