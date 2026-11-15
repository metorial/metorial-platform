import { Service } from '@lowerdeck/service';
import { globalDB } from '../db';

class CellRepository {
  async getCell(d: { cellIdentifier: string }) {
    return await globalDB.cell.findFirst({
      where: {
        identifier: d.cellIdentifier
      }
    });
  }

  async listCells() {
    return await globalDB.cell.findMany();
  }
}

export let cellRepository = Service.create(
  'cellRepository',
  () => new CellRepository()
).build();
