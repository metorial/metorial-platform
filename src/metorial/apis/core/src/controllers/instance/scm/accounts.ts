import { v } from '@lowerdeck/validation';
import { scmRepositoryService } from '@metorial-subspace/module-custom-provider';
import { Controller } from '@metorial/rest';
import { checkAccess } from '../../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { scmAccountPreviewPresenter } from '../../../presenters';

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
      .use(checkAccess({ possibleScopes: ['instance.scm.account:read'] }))
      .body(
        'default',
        v.object({
          installation_id: v.string({ description: 'SCM installation ID' })
        })
      )
      .output(scmAccountPreviewPresenter)
      .do(async ctx => {
        let { accounts } = await scmRepositoryService.listScmAccountPreviews({
          instance: ctx.instance,
          input: {
            scmConnectionId: ctx.body.installation_id
          }
        });

        return scmAccountPreviewPresenter.present({
          accountPreviews: accounts
        });
      })
  }
);
