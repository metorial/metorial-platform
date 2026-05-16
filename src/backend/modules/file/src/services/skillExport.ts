import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { cargo, type CargoActor, type CargoSkillExport } from '../cargo';
import {
  resolveCargoAccess,
  type CargoAccessActor,
  type CargoStorePermission
} from './access';
import type { FileOwner } from './file';
import { fileService, type EnrichedCargoFile } from './file';
import {
  documentParticipantService,
  type EnrichedCargoDocumentActor
} from './documentParticipant';

type SkillExportAccessInput = {
  owner: FileOwner;
  accessActor?: CargoAccessActor;
  defaultPermissions?: CargoStorePermission[];
  overridePermissions?: boolean;
  filterByCreator?: boolean;
};

type CreateSkillExportInput =
  | {
      target: 'skill';
      skillId: string;
    }
  | {
      target: 'plugin';
      skillPluginId: string;
    }
  | {
      target: 'marketplace';
      skillMarketplaceId: string;
    };

export type EnrichedCargoSkillExport = Omit<CargoSkillExport, 'file' | 'createdBy'> & {
  file: EnrichedCargoFile | null;
  createdBy: EnrichedCargoDocumentActor | null;
};

class SkillExportServiceImpl {
  private async enrichSkillExport(d: {
    owner: FileOwner;
    skillExport: CargoSkillExport;
  }): Promise<EnrichedCargoSkillExport> {
    let [createdBy] = d.skillExport.createdBy
      ? await documentParticipantService.enrichActors({
          owner: d.owner,
          actors: [d.skillExport.createdBy as CargoActor]
        })
      : [];

    return {
      ...d.skillExport,
      file: d.skillExport.file
        ? await fileService.enrichFile({
            owner: d.owner,
            file: d.skillExport.file
          })
        : null,
      createdBy: createdBy ?? null
    };
  }

  private async enrichSkillExports(d: {
    owner: FileOwner;
    skillExports: CargoSkillExport[];
  }): Promise<EnrichedCargoSkillExport[]> {
    return await Promise.all(
      d.skillExports.map(skillExport =>
        this.enrichSkillExport({
          owner: d.owner,
          skillExport
        })
      )
    );
  }

  async createSkillExport(
    d: SkillExportAccessInput & {
      input: CreateSkillExportInput;
    }
  ) {
    let { scope, actorId } = await resolveCargoAccess(d);

    return await this.enrichSkillExport({
      owner: d.owner,
      skillExport: await cargo.skillExport.create({
        tenantId: scope.tenantId,
        environmentId: scope.environmentId,
        actorId,
        ...d.input
      })
    });
  }

  async listSkillExports(
    d: SkillExportAccessInput & {
      ids?: string[];
      targets?: Array<'skill' | 'plugin' | 'marketplace'>;
      statuses?: Array<'pending' | 'completed' | 'failed'>;
    }
  ) {
    let { scope, actorId } = await resolveCargoAccess(d);

    return Paginator.create(() => async input => {
      let result = await cargo.skillExport.list({
        tenantId: scope.tenantId,
        environmentId: scope.environmentId,
        skillExportIds: d.ids,
        targets: d.targets,
        statuses: d.statuses,
        actorId: d.filterByCreator ? actorId : undefined,
        ...input
      });

      return {
        items: await this.enrichSkillExports({
          owner: d.owner,
          skillExports: result.items
        }),
        pagination: {
          hasNextPage: result.pagination.has_more_after,
          hasPreviousPage: result.pagination.has_more_before
        }
      };
    });
  }

  async getSkillExportById(
    d: SkillExportAccessInput & {
      skillExportId: string;
    }
  ) {
    let { scope, actorId } = await resolveCargoAccess(d);

    return await this.enrichSkillExport({
      owner: d.owner,
      skillExport: await cargo.skillExport.get({
        tenantId: scope.tenantId,
        environmentId: scope.environmentId,
        skillExportId: d.skillExportId,
        actorId: d.filterByCreator ? actorId : undefined
      })
    });
  }
}

export let skillExportService = Service.create(
  'skillExport',
  () => new SkillExportServiceImpl()
).build();
