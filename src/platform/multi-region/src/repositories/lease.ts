import { Service } from '@lowerdeck/service';
import { cell } from '../cell';
import { globalDB, Prisma } from '../db';

class LeaseGlobalRepositoryImpl {
  async tryAcquireLease(d: { name: string; token: string; ttlMs: number }) {
    let currentCell = await cell;
    let now = new Date();
    let expiresAt = new Date(now.getTime() + d.ttlMs);

    return await globalDB.$transaction(async tx => {
      let existing = await tx.globalLease.findUnique({
        where: {
          name: d.name
        }
      });

      if (!existing) {
        try {
          await tx.globalLease.create({
            data: {
              name: d.name,
              token: d.token,
              expiresAt,
              holderOid: currentCell.oid
            }
          });
          return true;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code == 'P2002') {
            return false;
          }

          throw error;
        }
      }

      let acquired = await tx.globalLease.updateMany({
        where: {
          name: d.name,
          OR: [
            { token: null },
            { token: d.token },
            { expiresAt: null },
            { expiresAt: { lte: now } }
          ]
        },
        data: {
          token: d.token,
          expiresAt,
          holderOid: currentCell.oid
        }
      });

      return acquired.count === 1;
    });
  }

  async renewLease(d: { name: string; token: string; ttlMs: number }) {
    let renewed = await globalDB.globalLease.updateMany({
      where: {
        name: d.name,
        token: d.token
      },
      data: {
        expiresAt: new Date(Date.now() + d.ttlMs)
      }
    });

    return renewed.count === 1;
  }

  async releaseLease(d: { name: string; token: string }) {
    await globalDB.globalLease.updateMany({
      where: {
        name: d.name,
        token: d.token
      },
      data: {
        token: null,
        expiresAt: null,
        holderOid: null
      }
    });
  }
}

export let leaseGlobalRepository = Service.create(
  'leaseGlobalRepository',
  () => new LeaseGlobalRepositoryImpl()
).build();
