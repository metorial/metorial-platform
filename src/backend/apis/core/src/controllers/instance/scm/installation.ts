import { Paginator } from '@mtsrc/pagination';
import { v } from '@mtsrc/validation';
import {
  subspaceScmConnectionService,
  subspaceScmConnectionSetupSessionService
} from '@metorial/module-subspace';
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
        let paginator = await subspaceScmConnectionService.list({
          instance: ctx.instance,
          organizationActor: ctx.actor!
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, scmConnection =>
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
        let scmConnectionSetup = await subspaceScmConnectionSetupSessionService.create({
          instance: ctx.instance,
          redirectUrl: ctx.body.redirect_url,

          // @ts-ignore
          organizationActor: ctx.actor!
        });

        return scmConnectionSetupPresenter.present({
          scmConnectionSetup
        });
      })
  }
);
