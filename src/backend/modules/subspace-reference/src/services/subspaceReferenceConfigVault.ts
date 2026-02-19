import { db, Instance } from '@metorial/db';
import { Service } from '@metorial/service';

class SubspaceReferenceConfigVaultServiceImpl {
  async create(input: {
    instance: Instance;
    configVault: {
      id: string;
      providerId: string;
      providerDeploymentId: string | null;
      name: string | null;
      isEphemeral?: boolean;
      createdAt: Date;
    };
  }) {
    return db.subspaceReferenceConfigVault.create({
      data: {
        id: input.configVault.id,
        instanceOid: input.instance.oid,
        providerId: input.configVault.providerId,
        providerDeploymentId: input.configVault.providerDeploymentId,
        name: input.configVault.name,
        isEphemeral: input.configVault.isEphemeral ?? false,
        subspaceCreatedAt: input.configVault.createdAt
      }
    });
  }

  async delete(input: { instance: Instance; id: string }) {
    return db.subspaceReferenceConfigVault.delete({
      where: {
        id: input.id
      }
    });
  }
}

export let subspaceReferenceConfigVaultService = Service.create(
  'subspaceReferenceConfigVault',
  () => new SubspaceReferenceConfigVaultServiceImpl()
).build();
