import { db, Instance } from '@metorial/db';
import { Service } from '@metorial/service';

class SubspaceReferenceAuthExportServiceImpl {
  async create(input: {
    instance: Instance;
    authExport: {
      id: string;
      providerAuthConfigId: string;
      createdAt: Date;
    };
  }) {
    return db.subspaceReferenceAuthExport.create({
      data: {
        id: input.authExport.id,
        instanceOid: input.instance.oid,
        providerAuthConfigId: input.authExport.providerAuthConfigId,
        subspaceCreatedAt: input.authExport.createdAt
      }
    });
  }

  async delete(input: { instance: Instance; id: string }) {
    return db.subspaceReferenceAuthExport.delete({
      where: {
        id: input.id
      }
    });
  }
}

export let subspaceReferenceAuthExportService = Service.create(
  'subspaceReferenceAuthExport',
  () => new SubspaceReferenceAuthExportServiceImpl()
).build();
