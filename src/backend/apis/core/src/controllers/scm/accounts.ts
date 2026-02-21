import { scmRepositoryService } from '@metorial/module-subspace';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { checkAccess } from '../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { scmAccountPreviewPresenter } from '../../presenters';
import { ScmAccountPreview } from '../../presenters/types';

export let scmAccountsController = Controller.create(
  {
    name: 'SCM Accounts',
    description: 'Preview SCM accounts from an installation.'
  },
  {
    preview: instanceGroup
      .post(instancePath('scm/accounts/preview', 'scm.accounts.preview'), {
        name: 'Preview SCM accounts',
        description: 'Lists available accounts from an SCM installation.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider:read'] }))
      .body(
        'default',
        v.object({
          installation_id: v.string({ description: 'SCM installation ID' })
        })
      )
      .outputList(scmAccountPreviewPresenter)
      .do(async ctx => {
        let accounts = await (scmRepositoryService as any).listAccountPreviews({
          instance: ctx.instance,
          scmConnectionId: ctx.body.installation_id
        });

        let items = (accounts as any)?.items ?? accounts ?? [];

        return {
          object: 'list' as const,
          items: await Promise.all(
            (Array.isArray(items) ? items : []).map((a: any) =>
              scmAccountPreviewPresenter
                .present({ accountPreview: a as ScmAccountPreview })
            )
          )
        };
      })
  }
);
