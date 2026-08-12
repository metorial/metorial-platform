import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  scmConnectionService,
  scmConnectionSetupSessionService
} from '@metorial-subspace/module-custom-provider';
import { Controller } from '@metorial/rest';
import { checkAccess } from '../../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { scmConnectionPresenter, scmConnectionSetupPresenter } from '../../../presenters';

export let scmInstallationController = Controller.create(
  {
    name: 'SCM Installations',
    description:
      'Manage source control management installations (e.g. GitHub App installations).'
  },
  {
    list: instanceGroup
      .get(instancePath('scm/installations', 'scm.installation.list'), {
        name: 'List SCM installations',
        description: 'Returns a paginated list of SCM installations.'
      })
      .use(checkAccess({ possibleScopes: ['instance.scm.installation:read'] }))
      .outputList(scmConnectionPresenter)
      .query('default', Paginator.validate())
      .do(async ctx => {
        let list = await scmConnectionService.listScmConnections({
          instance: ctx.instance,
          organizationActor: ctx.actor!,
          ...ctx.query
        });

        return Paginator.present(
          {
            items: list.items,
            pagination: {
              hasNextPage: list.pagination.has_more_after,
              hasPreviousPage: list.pagination.has_more_before
            }
          },
          scmConnection =>
            scmConnectionPresenter.present({
              scmConnection
            })
        );
      }),

    create: instanceGroup
      .post(instancePath('scm/installations', 'scm.installation.create'), {
        name: 'Create SCM installation',
        description: 'Initiates an SCM installation setup (e.g. GitHub App authorization).'
      })
      .use(checkAccess({ possibleScopes: ['instance.scm.installation:write'] }))
      .body(
        'default',
        v.object({
          redirect_url: v.optional(
            v.string({ description: 'URL to redirect after authorization' })
          )
        })
      )
      .output(scmConnectionSetupPresenter)
      .do(async ctx => {
        let scmConnectionSetup = await scmConnectionSetupSessionService.createScmConnectionSetupSession(
          {
            instance: ctx.instance,
            redirectUrl: ctx.body.redirect_url,
            organizationActor: ctx.actor!
          }
        );

        return scmConnectionSetupPresenter.present({
          scmConnectionSetup
        });
      })
  }
);
