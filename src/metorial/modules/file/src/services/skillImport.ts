import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { db } from '@metorial/db';
import { subspaceSkillService } from '@metorial/module-subspace';
import { cargo, type CargoSkillImport } from '../cargo';
import { resolveCargoAccess, type CargoAccessActor } from './access';
import type { FileOwner } from './file';

type SkillImportAccessInput = {
  owner: FileOwner;
  accessActor?: CargoAccessActor;
};

export type CreateSkillImportInput =
  | {
      type: 'public';
      repositoryUrl: string;
      ref?: string;
    }
  | {
      type: 'origin';
      repositoryId: string;
      ref?: string;
      path?: string;
    };

class SkillImportServiceImpl {
  private async reconcileCompletedSkills(d: {
    owner: FileOwner;
    skillImport: CargoSkillImport;
  }) {
    if (d.owner.type !== 'instance') return d.skillImport;
    let instance = d.owner.instance;

    let organizationActorId = d.skillImport.createdBy?.organizationActorId;
    let organizationActor = organizationActorId
      ? await db.organizationActor.findFirstOrThrow({
          where: {
            id: organizationActorId,
            organizationOid: instance.organizationOid
          }
        })
      : undefined;

    await Promise.all(
      d.skillImport.items.flatMap(item =>
        item.status === 'completed' && item.skill
          ? [
              subspaceSkillService.registerCargo({
                instance,
                organizationActor,
                skillId: item.skill.id
              })
            ]
          : []
      )
    );

    return d.skillImport;
  }

  async createSkillImport(d: SkillImportAccessInput & { input: CreateSkillImportInput }) {
    let { scope, actorId } = await resolveCargoAccess(d);

    return await cargo.skillImport.create({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      actorId,
      source: d.input
    });
  }

  async listSkillImports(
    d: SkillImportAccessInput & {
      ids?: string[];
      statuses?: Array<'pending' | 'processing' | 'completed' | 'failed'>;
      filterByCreator?: boolean;
    }
  ) {
    let { scope, actorId } = await resolveCargoAccess(d);

    return Paginator.create(() => async input => {
      let result = await cargo.skillImport.list({
        tenantId: scope.tenantId,
        environmentId: scope.environmentId,
        actorId: d.filterByCreator === false ? undefined : actorId,
        skillImportIds: d.ids,
        statuses: d.statuses,
        ...input
      });
      let items = await Promise.all(
        result.items.map(skillImport =>
          this.reconcileCompletedSkills({
            owner: d.owner,
            skillImport
          })
        )
      );

      return {
        items,
        pagination: {
          hasNextPage: result.pagination.has_more_after,
          hasPreviousPage: result.pagination.has_more_before
        }
      };
    });
  }

  async getSkillImportById(
    d: SkillImportAccessInput & {
      skillImportId: string;
      filterByCreator?: boolean;
    }
  ): Promise<CargoSkillImport> {
    let { scope, actorId } = await resolveCargoAccess(d);

    let skillImport = await cargo.skillImport.get({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      actorId: d.filterByCreator === false ? undefined : actorId,
      skillImportId: d.skillImportId
    });

    return await this.reconcileCompletedSkills({
      owner: d.owner,
      skillImport
    });
  }
}

export { type CargoSkillImport };

export let skillImportService = Service.create(
  'fileSkillImport',
  () => new SkillImportServiceImpl()
).build();
