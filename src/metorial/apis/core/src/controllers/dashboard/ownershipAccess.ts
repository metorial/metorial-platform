import { ownershipAccessService } from '@metorial-subspace/module-tenant';
import { ownershipAccessPresenter } from '@metorial/presenters';
import { Controller, Path } from '@metorial/rest';
import { getOwnershipActor } from '../../lib/ownershipActor';
import { checkAccess } from '../../middleware/checkAccess';
import { instanceGroup } from '../../middleware/instanceGroup';
import { isDashboardGroup } from '../../middleware/isDashboard';

export let dashboardOwnershipAccessController = Controller.create(
  {
    name: 'Ownership Access',
    description: 'Read how resource ownership restrictions apply to the caller.',
    hideInDocs: true
  },
  {
    get: instanceGroup
      .use(isDashboardGroup())
      .get(
        Path(
          '/dashboard/instances/:instanceId/ownership-access',
          'dashboard.instances.ownershipAccess.get'
        ),
        {
          name: 'Get ownership access',
          description:
            'Returns whether consumer-owned resources are restricted for the caller and which actors count as the caller.',
          hideInDocs: true
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider:read'] }))
      .output(ownershipAccessPresenter)
      .do(async ctx => {
        let ownershipAccess = await ownershipAccessService.getOwnershipAccess({
          instance: ctx.instance,
          organizationActor: getOwnershipActor(ctx)
        });

        return ownershipAccessPresenter.present({ ownershipAccess });
      })
  }
);
