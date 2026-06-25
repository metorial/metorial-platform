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
