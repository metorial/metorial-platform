import { db, Instance } from '@metorial/db';
import { Service } from '@metorial/service';

class SubspaceReferenceGroupServiceImpl {
  async create(input: {
    instance: Instance;
    group: {
      id: string;
      name: string | null;
      slug: string | null;
      createdAt: Date;
    };
  }) {
    return db.subspaceReferenceGroup.create({
      data: {
        id: input.group.id,
        instanceOid: input.instance.oid,
        name: input.group.name,
        slug: input.group.slug,
        subspaceCreatedAt: input.group.createdAt
      }
    });
  }

  async delete(input: { instance: Instance; id: string }) {
    return db.subspaceReferenceGroup.delete({
      where: {
        id: input.id
      }
    });
  }
}

export let subspaceReferenceGroupService = Service.create(
  'subspaceReferenceGroup',
  () => new SubspaceReferenceGroupServiceImpl()
).build();
