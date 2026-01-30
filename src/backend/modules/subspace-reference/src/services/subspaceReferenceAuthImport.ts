import { db, Instance } from '@metorial/db';
import { Service } from '@metorial/service';

class SubspaceReferenceAuthImportServiceImpl {
  async create(input: {
    instance: Instance;
    authImport: {
      id: string;
      providerId: string | null;
      providerDeploymentId: string | null;
      providerAuthConfigId: string | null;
      createdAt: Date;
    };
  }) {
    return db.subspaceReferenceAuthImport.create({
      data: {
        id: input.authImport.id,
        instanceOid: input.instance.oid,
        providerId: input.authImport.providerId,
        providerDeploymentId: input.authImport.providerDeploymentId,
        providerAuthConfigId: input.authImport.providerAuthConfigId,
        subspaceCreatedAt: input.authImport.createdAt
      }
    });
  }

  async delete(input: { instance: Instance; id: string }) {
    return db.subspaceReferenceAuthImport.delete({
      where: {
        instanceOid_id: {
          instanceOid: input.instance.oid,
          id: input.id
        }
      }
    });
  }
}

export let subspaceReferenceAuthImportService = Service.create(
  'subspaceReferenceAuthImport',
  () => new SubspaceReferenceAuthImportServiceImpl()
).build();
