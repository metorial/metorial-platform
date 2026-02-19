import { db, Instance } from '@metorial/db';
import { Service } from '@metorial/service';

class SubspaceReferenceAuthConfigServiceImpl {
  async create(input: {
    instance: Instance;
    authConfig: {
      id: string;
      providerId: string;
      providerDeploymentId: string | null;
      providerAuthMethodId: string;
      name: string | null;
      isEphemeral?: boolean;
      createdAt: Date;
    };
  }) {
    return db.subspaceReferenceAuthConfig.create({
      data: {
        id: input.authConfig.id,
        instanceOid: input.instance.oid,
        providerId: input.authConfig.providerId,
        providerDeploymentId: input.authConfig.providerDeploymentId,
        providerAuthMethodId: input.authConfig.providerAuthMethodId,
        name: input.authConfig.name,
        isEphemeral: input.authConfig.isEphemeral ?? false,
        subspaceCreatedAt: input.authConfig.createdAt
      }
    });
  }

  async delete(input: { instance: Instance; id: string }) {
    return db.subspaceReferenceAuthConfig.delete({
      where: {
        id: input.id
      }
    });
  }
}

export let subspaceReferenceAuthConfigService = Service.create(
  'subspaceReferenceAuthConfig',
  () => new SubspaceReferenceAuthConfigServiceImpl()
).build();
