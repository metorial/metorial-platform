import { db, Instance } from '@metorial/db';
import { Service } from '@metorial/service';

class SubspaceReferenceAuthCredentialsServiceImpl {
  async create(input: {
    instance: Instance;
    authCredentials: {
      id: string;
      providerId: string;
      providerAuthMethodId: string | null;
      name: string | null;
      isEphemeral?: boolean;
      createdAt: Date;
    };
  }) {
    return db.subspaceReferenceAuthCredentials.create({
      data: {
        id: input.authCredentials.id,
        instanceOid: input.instance.oid,
        providerId: input.authCredentials.providerId,
        providerAuthMethodId: input.authCredentials.providerAuthMethodId ?? '',
        name: input.authCredentials.name,
        isEphemeral: input.authCredentials.isEphemeral ?? false,
        subspaceCreatedAt: input.authCredentials.createdAt
      }
    });
  }

  async delete(input: { instance: Instance; id: string }) {
    return db.subspaceReferenceAuthCredentials.delete({
      where: {
        id: input.id
      }
    });
  }
}

export let subspaceReferenceAuthCredentialsService = Service.create(
  'subspaceReferenceAuthCredentials',
  () => new SubspaceReferenceAuthCredentialsServiceImpl()
).build();
