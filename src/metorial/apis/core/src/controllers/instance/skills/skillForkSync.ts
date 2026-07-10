import { badRequestError, ServiceError } from '@lowerdeck/error';
import { v } from '@lowerdeck/validation';
import { skillForkSyncService } from '@metorial/module-file';
import { Controller } from '@metorial/rest';
import { getInstanceCargoAccess } from '../../../lib/cargoAccess';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { skillForkSyncPresenter } from '../../../presenters';

let readScopes = ['instance.skill:read', 'consumer#instance.skill:read'] as const;
let writeScopes = ['instance.skill:write', 'consumer#instance.skill:write'] as const;

let getAccess = (ctx: any) => ({
  owner: {
    type: 'instance' as const,
    instance: ctx.instance,
    organization: ctx.organization
  },
  ...getInstanceCargoAccess(ctx)
});

export let skillForkSyncGroup = instanceGroup
  .use(hasFlags(['skills-enabled']))
  .use(async ctx => {
    if (!ctx.params.skillForkSyncId) {
      throw new ServiceError(
        badRequestError({
          message: 'skillForkSyncId is required',
          description: 'The skillForkSyncId path parameter is required.'
        })
      );
    }

    let skillForkSync = await skillForkSyncService.getSkillForkSyncById({
      ...getAccess(ctx),
      skillForkSyncId: ctx.params.skillForkSyncId
    });

    return { skillForkSync };
  });

export let skillForkSyncController = Controller.create(
  {
    name: 'Skill Fork Syncs',
    description: 'Synchronize changes from an upstream skill into a fork.'
  },
  {
    create: instanceGroup
      .post(instancePath('skill-fork-syncs', 'skills.forkSyncs.create'), {
        name: 'Create skill fork sync',
        description: 'Queues synchronization of upstream changes into a forked skill.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...writeScopes] }))
      .body(
        'default',
        v.object({
          skill_id: v.string()
        })
      )
      .output(skillForkSyncPresenter)
      .do(async ctx => {
        let skillForkSync = await skillForkSyncService.createSkillForkSync({
          ...getAccess(ctx),
          forkSkillId: ctx.body.skill_id
        });

        return skillForkSyncPresenter.present({ skillForkSync });
      }),

    get: skillForkSyncGroup
      .get(instancePath('skill-fork-syncs/:skillForkSyncId', 'skills.forkSyncs.get'), {
        name: 'Get skill fork sync',
        description: 'Retrieves the state of a fork synchronization.'
      })
      .use(checkAccess({ possibleScopes: [...readScopes] }))
      .output(skillForkSyncPresenter)
      .do(async ctx => skillForkSyncPresenter.present({ skillForkSync: ctx.skillForkSync }))
  }
);
