import { Service } from '@lowerdeck/service';
import { db, type Tenant } from '@metorial-subspace/db';
import type {
  Consumer as MetorialConsumer,
  ConsumerProfile as MetorialConsumerProfile,
  Instance as MetorialInstance,
  InstanceConsumer as MetorialInstanceConsumer,
  Organization as MetorialOrganization,
  OrganizationActor as MetorialOrganizationActor,
  OrganizationMember as MetorialOrganizationMember,
  Project as MetorialProject
} from '@metorial/db';
import { metorialDb } from '../lib/metorialDb';
import {
  assertMirrorIdentity,
  upsertInstanceMirror,
  upsertOrganizationActorMirror,
  upsertOrganizationMirror,
  upsertProjectMirror
} from '../lib/mirrorRecords';
import { getOrganizationActorInternalActorIdentifier } from '../lib/scopeIds';
import { backfillMirrorReferencesService } from './backfillMirrorReferences';
import { subspaceScopeService } from './subspaceScope';
import { tenantService } from './tenant';

class metorialResourceServiceImpl {
  async syncOrganization(organization: MetorialOrganization) {
    return await upsertOrganizationMirror(organization);
  }

  async syncProject(project: MetorialProject) {
    let organization = await metorialDb.organization.findUniqueOrThrow({
      where: { oid: project.organizationOid }
    });
    await this.syncOrganization(organization);

    let { tenant } = await subspaceScopeService.ensureForProject(project);
    let mirrored = await upsertProjectMirror({ project, tenantOid: tenant.oid });

    await backfillMirrorReferencesService.backfillTenantReferences({
      tenantOid: tenant.oid
    });
    await linkOrganizationActorsToTenant(tenant, project.organizationOid);
    return mirrored;
  }

  async syncInstance(instance: MetorialInstance) {
    let project = await metorialDb.project.findUniqueOrThrow({
      where: { oid: instance.projectOid }
    });
    await this.syncProject(project);

    let { tenant, environment } = await subspaceScopeService.ensureForInstance(instance);
    let mirrored = await upsertInstanceMirror({
      instance,
      environmentOid: environment.oid
    });

    await tenantService.ensureNetworksForTenant(tenant);
    await backfillMirrorReferencesService.backfillEnvironmentReferences({
      environmentOid: environment.oid
    });
    return mirrored;
  }

  async syncOrganizationActor(actor: MetorialOrganizationActor) {
    let organization = await metorialDb.organization.findUniqueOrThrow({
      where: { oid: actor.organizationOid }
    });
    await this.syncOrganization(organization);

    let mirrored = await upsertOrganizationActorMirror(actor);

    await linkOrganizationActorToTenants(actor);
    return mirrored;
  }

  async syncOrganizationMember(member: MetorialOrganizationMember) {
    let actor = await metorialDb.organizationActor.findUniqueOrThrow({
      where: { oid: member.actorOid }
    });
    await this.syncOrganizationActor(actor);

    let matches = await db.organizationMember.findMany({
      where: {
        OR: [{ oid: member.oid }, { id: member.id }]
      },
      select: { oid: true, id: true }
    });
    assertMirrorIdentity('organization member', member, matches);

    return await db.organizationMember.upsert({
      where: { oid: member.oid },
      update: {
        role: member.role,
        status: member.status,
        isV2Member: member.isV2Member,
        usesMetorialPersonal: member.usesMetorialPersonal,
        lastActiveAt: member.lastActiveAt,
        deletedAt: member.deletedAt,
        organizationOid: member.organizationOid,
        actorOid: member.actorOid,
        createdAt: member.createdAt,
        updatedAt: member.updatedAt
      },
      create: {
        oid: member.oid,
        id: member.id,
        role: member.role,
        status: member.status,
        isV2Member: member.isV2Member,
        usesMetorialPersonal: member.usesMetorialPersonal,
        lastActiveAt: member.lastActiveAt,
        deletedAt: member.deletedAt,
        organizationOid: member.organizationOid,
        actorOid: member.actorOid,
        createdAt: member.createdAt,
        updatedAt: member.updatedAt
      }
    });
  }

  private async syncConsumerAttribution(d: {
    organizationMemberOid: bigint | null;
    organizationActorOid: bigint | null;
  }) {
    let member: MetorialOrganizationMember | null = null;
    if (d.organizationMemberOid !== null) {
      member = await metorialDb.organizationMember.findUniqueOrThrow({
        where: { oid: d.organizationMemberOid }
      });
      await this.syncOrganizationMember(member);
    }

    if (d.organizationActorOid !== null && d.organizationActorOid !== member?.actorOid) {
      let actor = await metorialDb.organizationActor.findUniqueOrThrow({
        where: { oid: d.organizationActorOid }
      });
      await this.syncOrganizationActor(actor);
    }
  }

  async syncConsumer(consumer: MetorialConsumer) {
    let organization = await metorialDb.organization.findUniqueOrThrow({
      where: { oid: consumer.organizationOid }
    });
    await this.syncOrganization(organization);
    await this.syncConsumerAttribution(consumer);

    let matches = await db.consumer.findMany({
      where: {
        OR: [{ oid: consumer.oid }, { id: consumer.id }]
      },
      select: { oid: true, id: true }
    });
    assertMirrorIdentity('consumer', consumer, matches);

    return await db.consumer.upsert({
      where: { oid: consumer.oid },
      update: {
        name: consumer.name,
        email: consumer.email,
        organizationOid: consumer.organizationOid,
        organizationMemberOid: consumer.organizationMemberOid,
        organizationActorOid: consumer.organizationActorOid,
        isOrganizationMember: consumer.isOrganizationMember,
        isPortalConsumer: consumer.isPortalConsumer,
        isManuallyCreated: consumer.isManuallyCreated,
        isPending: consumer.isPending,
        createdAt: consumer.createdAt,
        updatedAt: consumer.updatedAt
      },
      create: {
        oid: consumer.oid,
        id: consumer.id,
        name: consumer.name,
        email: consumer.email,
        organizationOid: consumer.organizationOid,
        organizationMemberOid: consumer.organizationMemberOid,
        organizationActorOid: consumer.organizationActorOid,
        isOrganizationMember: consumer.isOrganizationMember,
        isPortalConsumer: consumer.isPortalConsumer,
        isManuallyCreated: consumer.isManuallyCreated,
        isPending: consumer.isPending,
        createdAt: consumer.createdAt,
        updatedAt: consumer.updatedAt
      }
    });
  }

  async syncInstanceConsumer(instanceConsumer: MetorialInstanceConsumer) {
    let [instance, consumer] = await Promise.all([
      metorialDb.instance.findUniqueOrThrow({
        where: { oid: instanceConsumer.instanceOid }
      }),
      metorialDb.consumer.findUniqueOrThrow({
        where: { oid: instanceConsumer.consumerOid }
      })
    ]);
    await this.syncInstance(instance);
    await this.syncConsumer(consumer);
    await this.syncConsumerAttribution(instanceConsumer);

    let matches = await db.instanceConsumer.findMany({
      where: {
        OR: [{ oid: instanceConsumer.oid }, { id: instanceConsumer.id }]
      },
      select: { oid: true, id: true }
    });
    assertMirrorIdentity('instance consumer', instanceConsumer, matches);

    return await db.instanceConsumer.upsert({
      where: { oid: instanceConsumer.oid },
      update: {
        name: instanceConsumer.name,
        email: instanceConsumer.email,
        instanceOid: instanceConsumer.instanceOid,
        consumerOid: instanceConsumer.consumerOid,
        organizationMemberOid: instanceConsumer.organizationMemberOid,
        organizationActorOid: instanceConsumer.organizationActorOid,
        isPending: instanceConsumer.isPending,
        createdAt: instanceConsumer.createdAt,
        updatedAt: instanceConsumer.updatedAt
      },
      create: {
        oid: instanceConsumer.oid,
        id: instanceConsumer.id,
        name: instanceConsumer.name,
        email: instanceConsumer.email,
        instanceOid: instanceConsumer.instanceOid,
        consumerOid: instanceConsumer.consumerOid,
        organizationMemberOid: instanceConsumer.organizationMemberOid,
        organizationActorOid: instanceConsumer.organizationActorOid,
        isPending: instanceConsumer.isPending,
        createdAt: instanceConsumer.createdAt,
        updatedAt: instanceConsumer.updatedAt
      }
    });
  }

  async syncConsumerProfile(consumerProfile: MetorialConsumerProfile) {
    let instanceConsumer = await metorialDb.instanceConsumer.findUniqueOrThrow({
      where: {
        instanceOid_consumerOid: {
          instanceOid: consumerProfile.instanceOid,
          consumerOid: consumerProfile.consumerOid
        }
      }
    });
    await this.syncInstanceConsumer(instanceConsumer);
    await this.syncConsumerAttribution(consumerProfile);

    let matches = await db.consumerProfile.findMany({
      where: {
        OR: [{ oid: consumerProfile.oid }, { id: consumerProfile.id }]
      },
      select: { oid: true, id: true }
    });
    assertMirrorIdentity('consumer profile', consumerProfile, matches);

    return await db.consumerProfile.upsert({
      where: { oid: consumerProfile.oid },
      update: {
        status: consumerProfile.status,
        inviteStatus: consumerProfile.inviteStatus,
        name: consumerProfile.name,
        email: consumerProfile.email,
        organizationOid: consumerProfile.organizationOid,
        instanceOid: consumerProfile.instanceOid,
        consumerOid: consumerProfile.consumerOid,
        organizationMemberOid: consumerProfile.organizationMemberOid,
        organizationActorOid: consumerProfile.organizationActorOid,
        deletedAt: consumerProfile.deletedAt,
        createdAt: consumerProfile.createdAt,
        updatedAt: consumerProfile.updatedAt
      },
      create: {
        oid: consumerProfile.oid,
        id: consumerProfile.id,
        status: consumerProfile.status,
        inviteStatus: consumerProfile.inviteStatus,
        name: consumerProfile.name,
        email: consumerProfile.email,
        organizationOid: consumerProfile.organizationOid,
        instanceOid: consumerProfile.instanceOid,
        consumerOid: consumerProfile.consumerOid,
        organizationMemberOid: consumerProfile.organizationMemberOid,
        organizationActorOid: consumerProfile.organizationActorOid,
        deletedAt: consumerProfile.deletedAt,
        createdAt: consumerProfile.createdAt,
        updatedAt: consumerProfile.updatedAt
      }
    });
  }

  async syncConsumerGraph(consumer: MetorialConsumer) {
    await this.syncConsumer(consumer);

    let [instanceConsumers, consumerProfiles] = await Promise.all([
      metorialDb.instanceConsumer.findMany({
        where: { consumerOid: consumer.oid },
        orderBy: { oid: 'asc' }
      }),
      metorialDb.consumerProfile.findMany({
        where: { consumerOid: consumer.oid },
        orderBy: { oid: 'asc' }
      })
    ]);
    for (let instanceConsumer of instanceConsumers) {
      await this.syncInstanceConsumer(instanceConsumer);
    }
    for (let consumerProfile of consumerProfiles) {
      await this.syncConsumerProfile(consumerProfile);
    }
  }

  async deleteConsumer(consumerId: string) {
    await db.consumer.deleteMany({
      where: { id: consumerId }
    });
  }

  async reconcileOrganization(organizationId: string) {
    let organization = await metorialDb.organization.findUniqueOrThrow({
      where: { id: organizationId },
      include: {
        projects: {
          orderBy: { oid: 'asc' },
          include: {
            instances: {
              orderBy: { oid: 'asc' }
            }
          }
        }
      }
    });

    await this.syncOrganization(organization);

    // A project whose subspace scope is still legacy refuses to provision, and letting that stop
    // the loop would leave its healthy siblings unmirrored too, so failures are collected and
    // raised once the rest of the organization is in sync.
    let failures: { projectId: string; error: unknown }[] = [];
    for (let project of organization.projects) {
      try {
        await this.syncProject(project);
        for (let instance of project.instances) {
          await this.syncInstance(instance);
        }
      } catch (error) {
        failures.push({ projectId: project.id, error });
      }
    }

    let linkedProjects = await metorialDb.project.findMany({
      where: {
        organizationOid: organization.oid,
        subspaceTenantId: { not: null }
      },
      select: { subspaceTenantId: true }
    });
    let subspaceTenantIds = [
      ...new Set(
        linkedProjects.flatMap(project =>
          project.subspaceTenantId ? [project.subspaceTenantId] : []
        )
      )
    ];

    await metorialDb.organization.update({
      where: { oid: organization.oid },
      data: { subspaceTenantIds }
    });

    if (failures.length > 0) {
      throw new Error(
        `Organization ${organizationId} has ${failures.length} project(s) that could not be reconciled: ${failures
          .map(
            ({ projectId, error }) =>
              `${projectId} (${error instanceof Error ? error.message : String(error)})`
          )
          .join('; ')}`
      );
    }
  }
}

let linkOrganizationActorToTenants = async (actor: MetorialOrganizationActor) => {
  let projects = await db.project.findMany({
    where: { organizationOid: actor.organizationOid },
    select: { tenantOid: true }
  });
  let existingActors = await db.tenantActor.findMany({
    where: {
      OR: [
        { organizationActorId: actor.id },
        { identifier: getOrganizationActorInternalActorIdentifier(actor) },
        ...(actor.internalActorIdentifier
          ? [{ identifier: actor.internalActorIdentifier }]
          : []),
        ...(actor.subspaceActorId ? [{ id: actor.subspaceActorId }] : [])
      ]
    },
    select: { tenantOid: true }
  });
  let tenantOids = [
    ...new Set([
      ...projects.map(project => project.tenantOid),
      ...existingActors.map(existing => existing.tenantOid)
    ])
  ];

  for (let tenantOid of tenantOids) {
    let tenant = await db.tenant.findUnique({
      where: { oid: tenantOid }
    });
    if (!tenant) continue;

    await subspaceScopeService.ensureForOrganizationActor({
      tenant,
      organizationActor: actor
    });
  }
};

let linkOrganizationActorsToTenant = async (tenant: Tenant, organizationOid: bigint) => {
  let organizationActors = await metorialDb.organizationActor.findMany({
    where: { organizationOid }
  });

  for (let organizationActor of organizationActors) {
    await subspaceScopeService.ensureForOrganizationActor({
      tenant,
      organizationActor
    });
  }
};

export let metorialResourceService = Service.create(
  'metorialResourceService',
  () => new metorialResourceServiceImpl()
).build();
