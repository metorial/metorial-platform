import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  subspaceScmProviderService,
  subspaceScmProviderSetupSessionService
} from '@metorial/module-subspace';
import { Controller } from '@metorial/rest';
import { checkAccess } from '../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { scmProviderPresenter, scmProviderSetupPresenter } from '../../presenters';

let scmProviderGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.scmProviderId) {
    throw new ServiceError(
      badRequestError({
        message: 'scmProviderId is required',
        description: 'The scmProviderId path parameter is required.'
      })
    );
  }

  let scmProvider = await subspaceScmProviderService.get({
    instance: ctx.instance,
    scmProviderId: ctx.params.scmProviderId
  });

  return { scmProvider };
});

export let scmProvidersController = Controller.create(
  {
    name: 'SCM Providers',
    description: 'Manage SCM providers configured for an instance.'
  },
  {
    list: instanceGroup
      .get(instancePath('scm/providers', 'scm.providers.list'), {
        name: 'List SCM providers',
        description: 'Returns a paginated list of SCM providers.'
      })
      .use(checkAccess({ possibleScopes: ['instance.scm.installation:read'] }))
      .outputList(scmProviderPresenter)
      .query('default', Paginator.validate())
      .do(async ctx => {
        let paginator = await subspaceScmProviderService.list({
          instance: ctx.instance
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, scmProvider =>
          scmProviderPresenter.present({
            scmProvider
          })
        );
      }),

    get: scmProviderGroup
      .get(instancePath('scm/providers/:scmProviderId', 'scm.providers.get'), {
        name: 'Get SCM provider',
        description: 'Retrieves a specific SCM provider by ID.'
      })
      .use(checkAccess({ possibleScopes: ['instance.scm.installation:read'] }))
      .output(scmProviderPresenter)
      .do(async ctx => {
        return scmProviderPresenter.present({
          scmProvider: ctx.scmProvider
        });
      }),

    create: instanceGroup
      .post(instancePath('scm/providers', 'scm.providers.create'), {
        name: 'Create SCM provider',
        description: 'Initiates a setup session for a self-hosted SCM provider.'
      })
      .use(checkAccess({ possibleScopes: ['instance.scm.installation:write'] }))
      .body(
        'default',
        v.object({
          type: v.enumOf(['github_enterprise', 'gitlab_selfhosted'], {
            description: 'Type of self-hosted SCM provider to configure'
          })
        })
      )
      .output(scmProviderSetupPresenter)
      .do(async ctx => {
        let scmProviderSetup = await subspaceScmProviderSetupSessionService.create({
          instance: ctx.instance,
          type: ctx.body.type
        });

        return scmProviderSetupPresenter.present({
          scmProviderSetup
        });
      })
  }
);
