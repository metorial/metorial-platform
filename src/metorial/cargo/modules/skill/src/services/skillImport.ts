import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { getId } from '@metorial/cargo-config/id';
import { type ResourceScope } from '@metorial/module-resource-tenant';
import { assertResourceActorScope } from '@metorial/module-access';
import type { Prisma, ResourceActor, SkillImportStatus } from '@metorial/db';
import { db } from '@metorial/db';
import { parsePublicRepositoryUrl } from '../import/publicRepository';
import { skillImportAcquireQueue } from '../queues/import/acquire';
import { skillRepositoryService } from './skillRepository';

export let skillImportInclude = {
  creatorResourceActor: true,
  items: {
    include: {
      skill: {
        include: {
          store: true,
          parentSkill: { select: { id: true } },
          parentSkillTemplate: { select: { id: true } }
        }
      }
    },
    orderBy: {
      createdAt: 'asc'
    }
  }
} satisfies Prisma.SkillImportInclude;

export type SkillImportRecord = Prisma.SkillImportGetPayload<{
  include: typeof skillImportInclude;
}>;

export type CreateSkillImportInput =
  | {
      type: 'public';
      repositoryUrl: string;
      ref?: string | null;
    }
  | {
      type: 'origin';
      repositoryId: string;
      ref?: string | null;
      path?: string | null;
    };

class SkillImportServiceImpl {
  async createSkillImport(
    d: ResourceScope & {
      actor?: ResourceActor;
      input: CreateSkillImportInput;
    }
  ) {
    assertResourceActorScope({
      resourceTenant: d.resourceTenant,
      resourceActor: d.actor
    });
    let creatorResourceActorOid = d.actor?.oid;
    let repositoryName: string;

    if (d.input.type === 'public') {
      repositoryName = parsePublicRepositoryUrl(d.input.repositoryUrl).repository;
    } else {
      repositoryName = (
        await skillRepositoryService.getOriginRepository({
          resourceTenant: d.resourceTenant!,
          resourceGroup: d.resourceGroup,
          repoId: d.input.repositoryId
        })
      ).name;
    }

    let ids = getId('skillImport');
    let skillImport = await db.skillImport.create({
      data: {
        oid: ids.oid,
        id: ids.id,
        sourceType: d.input.type === 'public' ? 'public_repository' : 'origin_repository',
        status: 'pending',
        repositoryUrl: d.input.type === 'public' ? d.input.repositoryUrl : null,
        repositoryId: d.input.type === 'origin' ? d.input.repositoryId : null,
        repositoryName,
        ref: d.input.ref ?? null,
        path: d.input.type === 'origin' ? (d.input.path ?? null) : null,
        creatorResourceActorOid,
        resourceTenantOid: d.resourceTenant.oid,
        resourceGroupOid: d.resourceGroup.oid
      },
      include: skillImportInclude
    });

    await skillImportAcquireQueue.add(
      { skillImportId: skillImport.id },
      { id: `skillImport:acquire:${skillImport.id}` }
    );
    return skillImport;
  }

  async listSkillImports(
    d: ResourceScope & {
      actor?: ResourceActor;
      ids?: string[];
      statuses?: SkillImportStatus[];
    }
  ) {
    assertResourceActorScope({
      resourceTenant: d.resourceTenant,
      resourceActor: d.actor
    });
    let creatorResourceActorOid = d.actor?.oid;
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.skillImport.findMany({
            ...opts,
            where: {
              resourceTenantOid: d.resourceTenant.oid,
              resourceGroupOid: d.resourceGroup.oid,
              creatorResourceActorOid,
              id: d.ids?.length ? { in: d.ids } : undefined,
              status: d.statuses?.length ? { in: d.statuses } : undefined
            },
            include: skillImportInclude
          })
      )
    );
  }

  async getSkillImportById(
    d: ResourceScope & {
      actor?: ResourceActor;
      skillImportId: string;
    }
  ) {
    assertResourceActorScope({
      resourceTenant: d.resourceTenant,
      resourceActor: d.actor
    });
    let creatorResourceActorOid = d.actor?.oid;
    let skillImport = await db.skillImport.findFirst({
      where: {
        id: d.skillImportId,
        resourceTenantOid: d.resourceTenant.oid,
        resourceGroupOid: d.resourceGroup.oid,
        creatorResourceActorOid
      },
      include: skillImportInclude
    });
    if (!skillImport) throw new ServiceError(notFoundError('skillImport', d.skillImportId));
    return skillImport;
  }
}

export let skillImportService = Service.create(
  'cargoSkillImportService',
  () => new SkillImportServiceImpl()
).build();
