import { serverCapabilitiesService } from '@metorial/module-catalog';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { serverCapabilitiesPresenter } from '../../presenters';

export let serverCapabilitiesController = Controller.create(
  {
    name: 'Server Capabilities',
    description: 'Get server capabilities information'
  },
  {
    list: instanceGroup
      .get(instancePath('server-capabilities', 'servers.capabilities.list'), {
        name: 'List server capabilities',
        description: 'List all server capabilities'
      })
      .use(checkAccess({ possibleScopes: ['instance.server_listing:read'] }))
      .output(serverCapabilitiesPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            server_deployment_ids: v.optional(v.union([v.string(), v.array(v.string())])),
            server_variant_ids: v.optional(v.union([v.string(), v.array(v.string())])),
            server_ids: v.optional(v.union([v.string(), v.array(v.string())])),
            server_version_ids: v.optional(v.union([v.string(), v.array(v.string())])),
            server_implementation_ids: v.optional(v.union([v.string(), v.array(v.string())]))
          })
        )
      )
      .do(async ctx => {
        let serverCapabilities = await serverCapabilitiesService.getManyServerCapabilities({
          serverDeploymentIds: normalizeArrayParam(ctx.query.server_deployment_ids),
          serverVariantIds: normalizeArrayParam(ctx.query.server_variant_ids),
          serverIds: normalizeArrayParam(ctx.query.server_ids),
          serverVersionIds: normalizeArrayParam(ctx.query.server_version_ids),
          serverImplementationIds: normalizeArrayParam(ctx.query.server_implementation_ids),

          instance: ctx.instance
        });

        return serverCapabilitiesPresenter.present({
          serverCapabilities
        });
      })
  }
);
