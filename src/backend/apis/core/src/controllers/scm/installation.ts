import {
  scmConnectionService,
  scmConnectionSetupSessionService,
  type SubspaceScmConnection
} from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { checkAccess } from '../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { scmConnectionPresenter, scmConnectionSetupPresenter } from '../../presenters';

export let scmInstallationController = Controller.create(
  {
    name: 'SCM Installations',
    description: 'Manage source control management installations (e.g. GitHub App installations).'
  },
  {
    list: instanceGroup
      .get(instancePath('scm/installations', 'scm.installation.list'), {
        name: 'List SCM installations',
        description: 'Returns a paginated list of SCM installations.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider:read'] }))
      .outputList(scmConnectionPresenter)
      .query('default', Paginator.validate())
      .do(async ctx => {
        let paginator = await scmConnectionService.list({
          instance: ctx.instance,
          organizationActor: ctx.actor
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, connection =>
          scmConnectionPresenter.present({
            scmConnection: connection as unknown as SubspaceScmConnection
          })
        );
      }),

    create: instanceGroup
      .post(instancePath('scm/installations', 'scm.installation.create'), {
        name: 'Create SCM installation',
        description: 'Initiates an SCM installation setup (e.g. GitHub App authorization).'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider:write'] }))
      .body(
        'default',
        v.object({
          provider: v.optional(v.string({ description: 'SCM provider type (e.g. github)' })),
          redirect_url: v.optional(v.string({ description: 'URL to redirect after authorization' }))
        })
      )
      .output(scmConnectionSetupPresenter)
      .do(async ctx => {
        let session = await scmConnectionSetupSessionService.create({
          instance: ctx.instance,
          organizationActor: ctx.actor,
          redirectUrl: ctx.body.redirect_url
        });

        let setupSession = (session as any).scmConnectionSetupSession ?? session;

        return scmConnectionSetupPresenter.present({
          scmConnectionSetup: setupSession
        });
      })
  }
);
