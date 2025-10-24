import { customServerDeploymentService } from '@metorial/module-custom-server';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { hasFlags } from '../../middleware/hasFlags';
import { instancePath } from '../../middleware/instanceGroup';
import { customServerDeploymentPresenter } from '../../presenters';
import { customServerGroup } from './customServer';

export let customServerDeploymentController = Controller.create(
  {
    name: 'Custom Server',
    description: 'Manager custom server deployments',
    hideInDocs: true
  },
  {
    list: customServerGroup
      .get(
        instancePath(
          'custom-servers/:customServerId/deployments',
          'custom_servers.deployments.list'
        ),
        {
          name: 'List custom server deployments',
          description: 'List all custom server deployments'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.custom_server:read'] }))
      .outputList(customServerDeploymentPresenter)
      .use(hasFlags(['metorial-gateway-enabled', 'paid-custom-servers']))
      .query(
        'default',
        Paginator.validate(
          v.object({
            version_id: v.optional(v.union([v.string(), v.array(v.string())]))
          })
        )
      )
      .do(async ctx => {
        let paginator = await customServerDeploymentService.listCustomServerDeployments({
          server: ctx.customServer,

          versionIds: normalizeArrayParam(ctx.query.version_id)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, customServerDeployment =>
          customServerDeploymentPresenter.present({ customServerDeployment })
        );
      }),

    get: customServerGroup
      .get(
        instancePath(
          'custom-servers/:customServerId/deployments/:customServerDeploymentId',
          'custom_servers.deployments.get'
        ),
        {
          name: 'Get custom server deployment',
          description: 'Get information for a specific custom server deployment'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.custom_server:read'] }))
      .output(customServerDeploymentPresenter)
      .use(hasFlags(['metorial-gateway-enabled', 'paid-custom-servers']))
      .do(async ctx => {
        let customServerDeployment =
          await customServerDeploymentService.getCustomServerDeploymentById({
            deploymentId: ctx.params.customServerDeploymentId,
            server: ctx.customServer
          });

        return customServerDeploymentPresenter.present({
          customServerDeployment
        });
      })
  }
);
