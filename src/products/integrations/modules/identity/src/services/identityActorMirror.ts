import { Service } from '@lowerdeck/service';
import { db } from '@metorial-subspace/db';
import { metorialDb } from '@metorial-subspace/module-tenant';

export let resolveMetorialInstance = async (d: {
  instanceOid: bigint | null;
  environmentOid: bigint;
}) => {
  let instanceOid = d.instanceOid;
  if (!instanceOid) {
    let environment = await db.environment.findUnique({
      where: { oid: d.environmentOid },
      select: { instanceOid: true }
    });
    instanceOid = environment?.instanceOid ?? null;
  }
  if (!instanceOid) return null;

  let instance = await db.instance.findUnique({
    where: { oid: instanceOid },
    select: { id: true }
  });
  if (!instance) return null;

  return metorialDb.instance.findUnique({
    where: { id: instance.id },
    select: { oid: true, projectOid: true, organizationOid: true }
  });
};

class identityActorMirrorServiceImpl {
  async syncIdentityActor(d: { identityActorId: string }) {
    let identityActor = await db.identityActor.findUnique({
      where: { id: d.identityActorId }
    });

    if (!identityActor) {
      await metorialDb.identityActor.updateMany({
        where: { id: d.identityActorId, status: { not: 'deleted' } },
        data: { status: 'deleted' }
      });
      return null;
    }

    let instance = await resolveMetorialInstance(identityActor);
    if (!instance) return null;

    let data = {
      type: identityActor.type,
      status: identityActor.status,
      name: identityActor.name,

      organizationOid: instance.organizationOid,
      projectOid: instance.projectOid,
      instanceOid: instance.oid,

      createdAt: identityActor.createdAt,
      updatedAt: identityActor.updatedAt,
      archivedAt: identityActor.archivedAt
    };

    let mirroredActor = await metorialDb.identityActor.upsert({
      where: { id: identityActor.id },
      create: { oid: identityActor.oid, id: identityActor.id, ...data },
      update: data
    });

    await metorialDb.consumerActor.updateMany({
      where: { id: identityActor.id, identityActorOid: null },
      data: { identityActorOid: mirroredActor.oid }
    });

    return mirroredActor;
  }

  async syncAgent(d: { agentId: string }) {
    let agent = await db.agent.findUnique({
      where: { id: d.agentId },
      include: { actor: { select: { id: true } } }
    });

    if (!agent) {
      await metorialDb.agent.updateMany({
        where: { id: d.agentId, status: { not: 'deleted' } },
        data: { status: 'deleted' }
      });
      return null;
    }

    let mirroredActor = await this.syncIdentityActor({ identityActorId: agent.actor.id });
    if (!mirroredActor) return null;

    let data = {
      type: agent.type,
      status: agent.status,
      name: agent.name,

      actorOid: mirroredActor.oid,
      organizationOid: mirroredActor.organizationOid,
      projectOid: mirroredActor.projectOid,
      instanceOid: mirroredActor.instanceOid,

      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt,
      archivedAt: agent.archivedAt
    };

    return metorialDb.agent.upsert({
      where: { id: agent.id },
      create: { oid: agent.oid, id: agent.id, ...data },
      update: data
    });
  }
}

export let identityActorMirrorService = Service.create(
  'identityActorMirror',
  () => new identityActorMirrorServiceImpl()
).build();
