import { Service } from '@lowerdeck/service';
import { globalDB } from '../db';

class CellTokenRepository {
  async findReusableCellToken(d: { cellOid: number; expiresAfter?: Date }) {
    return await globalDB.cellToken.findFirst({
      where: {
        cellOid: d.cellOid,
        expiresAt: d.expiresAfter ? { gt: d.expiresAfter } : { gt: new Date() }
      },
      include: {
        cell: true
      },
      orderBy: {
        expiresAt: 'desc'
      }
    });
  }

  async getCellToken(d: { cellIdentifier: string; cellTokenId: string }) {
    return await globalDB.cellToken.findFirst({
      where: {
        id: d.cellTokenId,
        cell: { identifier: d.cellIdentifier }
      },
      include: {
        cell: true
      }
    });
  }

  async createCellToken(d: { cellOid: number; ttlMs: number }) {
    let expiresAt = new Date(Date.now() + d.ttlMs);

    return await globalDB.cellToken.create({
      data: {
        cellOid: d.cellOid,
        token: crypto.randomUUID(),
        expiresAt
      },
      include: {
        cell: true
      }
    });
  }
}

export let cellTokenRepository = Service.create(
  'cellTokenRepository',
  () => new CellTokenRepository()
).build();

class HyperplaneTokenRepository {
  async findReusableHyperplaneToken(d: { hyperplaneIdentifier: string; expiresAfter?: Date }) {
    return await globalDB.hyperplaneToken.findFirst({
      where: {
        hyperplane: { identifier: d.hyperplaneIdentifier },
        expiresAt: d.expiresAfter ? { gt: d.expiresAfter } : { gt: new Date() }
      },
      include: {
        hyperplane: true
      },
      orderBy: {
        expiresAt: 'desc'
      }
    });
  }

  async getHyperplaneToken(d: { hyperplaneIdentifier: string; hyperplaneTokenId: string }) {
    return await globalDB.hyperplaneToken.findFirst({
      where: {
        id: d.hyperplaneTokenId,
        hyperplane: { identifier: d.hyperplaneIdentifier }
      },
      include: {
        hyperplane: true
      }
    });
  }

  async createHyperplaneToken(d: {
    hyperplaneIdentifier: string;
    ttlMs: number;
    cellOid?: number | null;
  }) {
    let expiresAt = new Date(Date.now() + d.ttlMs);

    let hyperplane = await globalDB.hyperplane.upsert({
      where: { identifier: d.hyperplaneIdentifier },
      create: {
        identifier: d.hyperplaneIdentifier,
        cellOid: d.cellOid ?? null
      },
      update: {
        cellOid: d.cellOid ?? undefined
      }
    });

    return await globalDB.hyperplaneToken.create({
      data: {
        hyperplaneOid: hyperplane.oid,
        token: crypto.randomUUID(),
        expiresAt
      },
      include: {
        hyperplane: true
      }
    });
  }
}

export let hyperplaneTokenRepository = Service.create(
  'hyperplaneTokenRepository',
  () => new HyperplaneTokenRepository()
).build();
