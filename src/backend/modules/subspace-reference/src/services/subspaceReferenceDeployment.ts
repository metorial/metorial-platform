import { db, Instance } from '@metorial/db';
import { Service } from '@metorial/service';

class SubspaceReferenceDeploymentServiceImpl {
  async create(input: {
    instance: Instance;
    deployment: {
      id: string;
      providerId: string;
      name: string | null;
      isEphemeral?: boolean;
      createdAt: Date;
    };
  }) {
    return db.subspaceReferenceDeployment.create({
      data: {
        id: input.deployment.id,
        instanceOid: input.instance.oid,
        providerId: input.deployment.providerId,
        name: input.deployment.name,
        isEphemeral: input.deployment.isEphemeral ?? false,
        subspaceCreatedAt: input.deployment.createdAt
      }
    });
  }

  async delete(input: { instance: Instance; id: string }) {
    return db.subspaceReferenceDeployment.delete({
      where: {
        id: input.id
      }
    });
  }
}

export let subspaceReferenceDeploymentService = Service.create(
  'subspaceReferenceDeployment',
  () => new SubspaceReferenceDeploymentServiceImpl()
).build();
