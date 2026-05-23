import { Paginator } from '@mtsrc/pagination';
import { Service } from '@mtsrc/service';
import { cargo, type CargoSkillParticipant } from '../cargo';
import { resolveCargoAccess, type CargoAccessActor } from './access';
import {
  documentParticipantService,
  type EnrichedCargoDocumentActor
} from './documentParticipant';
import type { FileOwner } from './file';

export type EnrichedCargoSkillParticipant = Omit<CargoSkillParticipant, 'actor'> & {
  actor: EnrichedCargoDocumentActor;
};

class SkillParticipantServiceImpl {
  private async enrichSkillParticipant(d: {
    owner: FileOwner;
    skillParticipant: CargoSkillParticipant;
  }): Promise<EnrichedCargoSkillParticipant> {
    let [actor] = await documentParticipantService.enrichActors({
      owner: d.owner,
      actors: [d.skillParticipant.actor]
    });

    return {
      ...d.skillParticipant,
      actor: actor!
    };
  }

  async getSkillParticipantById(d: {
    owner: FileOwner;
    skillParticipantId: string;
    accessActor?: CargoAccessActor;
  }) {
    let { scope } = await resolveCargoAccess(d);
    let skillParticipant = await cargo.skillParticipant.get({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      skillParticipantId: d.skillParticipantId
    });

    return await this.enrichSkillParticipant({
      owner: d.owner,
      skillParticipant
    });
  }

  async listSkillParticipants(d: {
    owner: FileOwner;
    skillId: string;
    accessActor?: CargoAccessActor;
  }) {
    let { scope } = await resolveCargoAccess(d);

    return Paginator.create(() => async input => {
      let result = await cargo.skillParticipant.list({
        tenantId: scope.tenantId,
        environmentId: scope.environmentId,
        skillId: d.skillId,
        ...input
      });

      return {
        items: await Promise.all(
          result.items.map(
            async skillParticipant =>
              await this.enrichSkillParticipant({
                owner: d.owner,
                skillParticipant
              })
          )
        ),
        pagination: {
          hasNextPage: result.pagination.has_more_after,
          hasPreviousPage: result.pagination.has_more_before
        }
      };
    });
  }
}

export let skillParticipantService = Service.create(
  'fileSkillParticipant',
  () => new SkillParticipantServiceImpl()
).build();
