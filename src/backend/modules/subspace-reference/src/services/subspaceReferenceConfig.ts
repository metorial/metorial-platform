import { db, Instance } from '@metorial/db';
import { Service } from '@metorial/service';

class SubspaceReferenceConfigServiceImpl {
  async create(input: {
    instance: Instance;
    config: {
      id: string;
      providerId: string;
      providerDeploymentId: string | null;
      name: string | null;
      isEphemeral?: boolean;
      createdAt: Date;
    };
  }) {
    return db.subspaceReferenceConfig.create({
      data: {
        id: input.config.id,
        instanceOid: input.instance.oid,
        providerId: input.config.providerId,
        providerDeploymentId: input.config.providerDeploymentId,
        name: input.config.name,
        isEphemeral: input.config.isEphemeral ?? false,
        subspaceCreatedAt: input.config.createdAt
      }
    });
  }

  async delete(input: { instance: Instance; id: string }) {
    return db.subspaceReferenceConfig.delete({
      where: {
        instanceOid_id: {
          instanceOid: input.instance.oid,
          id: input.id
        }
      }
    });
  }
}

export let subspaceReferenceConfigService = Service.create(
  'subspaceReferenceConfig',
  () => new SubspaceReferenceConfigServiceImpl()
).build();
