import { db, Instance } from '@metorial/db';
import { Service } from '@metorial/service';

class SubspaceReferenceSetupSessionServiceImpl {
  async create(input: {
    instance: Instance;
    setupSession: {
      id: string;
      providerId: string;
      providerDeploymentId: string | null;
      providerAuthMethodId: string;
      name: string | null;
      createdAt: Date;
    };
  }) {
    return db.subspaceReferenceSetupSession.create({
      data: {
        id: input.setupSession.id,
        instanceOid: input.instance.oid,
        providerId: input.setupSession.providerId,
        providerDeploymentId: input.setupSession.providerDeploymentId,
        providerAuthMethodId: input.setupSession.providerAuthMethodId,
        name: input.setupSession.name,
        subspaceCreatedAt: input.setupSession.createdAt
      }
    });
  }

  async delete(input: { instance: Instance; id: string }) {
    return db.subspaceReferenceSetupSession.delete({
      where: {
        id: input.id
      }
    });
  }
}

export let subspaceReferenceSetupSessionService = Service.create(
  'subspaceReferenceSetupSession',
  () => new SubspaceReferenceSetupSessionServiceImpl()
).build();
