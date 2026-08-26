import { withTransaction } from '@metorial/db';

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
