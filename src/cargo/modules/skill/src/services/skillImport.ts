import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Prisma, SkillImportStatus } from '@metorial-cargo/db';
import { db, getId } from '@metorial-cargo/db';
import { actorService, type CargoTenantEnvironment } from '@metorial-cargo/module-file';
import { parsePublicRepositoryUrl } from '../import/publicRepository';
import { skillImportAcquireQueue } from '../queues/import/acquire';
import { skillRepositoryService } from './skillRepository';

export let skillImportInclude = {
  creatorTenantActor: true,
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
  private async getCreatorOid(d: { tenant: { oid: bigint; id: string }; actorId?: string }) {
    if (!d.actorId) return undefined;
    return (
      await actorService.getActorById({
        tenant: d.tenant,
        actorId: d.actorId
      })
    ).oid;
  }

  async createSkillImport(
    d: CargoTenantEnvironment & {
      actorId?: string;
      input: CreateSkillImportInput;
    }
  ) {
    let creatorTenantActorOid = await this.getCreatorOid(d);
    let repositoryName: string;

    if (d.input.type === 'public') {
      repositoryName = parsePublicRepositoryUrl(d.input.repositoryUrl).repository;
    } else {
      repositoryName = (
        await skillRepositoryService.getOriginRepository({
          tenant: d.tenant,
          environment: d.environment,
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
        creatorTenantActorOid,
        tenantOid: d.tenant.oid,
        environmentOid: d.environment.oid
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
    d: CargoTenantEnvironment & {
      actorId?: string;
      ids?: string[];
      statuses?: SkillImportStatus[];
    }
  ) {
    let creatorTenantActorOid = await this.getCreatorOid(d);
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.skillImport.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              environmentOid: d.environment.oid,
              creatorTenantActorOid,
              id: d.ids?.length ? { in: d.ids } : undefined,
              status: d.statuses?.length ? { in: d.statuses } : undefined
            },
            include: skillImportInclude
          })
      )
    );
  }

  async getSkillImportById(
    d: CargoTenantEnvironment & {
      actorId?: string;
      skillImportId: string;
    }
  ) {
    let creatorTenantActorOid = await this.getCreatorOid(d);
    let skillImport = await db.skillImport.findFirst({
      where: {
        id: d.skillImportId,
        tenantOid: d.tenant.oid,
        environmentOid: d.environment.oid,
        creatorTenantActorOid
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
