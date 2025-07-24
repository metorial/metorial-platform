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
    description:
      'Describes the capabilities, i.e., the tools, resources, and prompts, that certain servers support.'
  },
  {
    list: instanceGroup
      .get(instancePath('server-capabilities', 'servers.capabilities.list'), {
        name: 'List server capabilities',
        description:
          'Returns a list of server capabilities, filterable by server attributes such as deployment, variant, or version.'
      })
      .use(checkAccess({ possibleScopes: ['instance.server_listing:read'] }))
      .output(serverCapabilitiesPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            server_deployment_id: v.optional(v.union([v.string(), v.array(v.string())])),
            server_variant_id: v.optional(v.union([v.string(), v.array(v.string())])),
            server_id: v.optional(v.union([v.string(), v.array(v.string())])),
            server_version_id: v.optional(v.union([v.string(), v.array(v.string())])),
            server_implementation_id: v.optional(v.union([v.string(), v.array(v.string())]))
          })
        )
      )
      .do(async ctx => {
        let serverCapabilities = await serverCapabilitiesService.getManyServerCapabilities({
          serverDeploymentIds: normalizeArrayParam(ctx.query.server_deployment_id),
          serverVariantIds: normalizeArrayParam(ctx.query.server_variant_id),
          serverIds: normalizeArrayParam(ctx.query.server_id),
          serverVersionIds: normalizeArrayParam(ctx.query.server_version_id),
          serverImplementationIds: normalizeArrayParam(ctx.query.server_implementation_id),
          instance: ctx.instance
        });

        return serverCapabilitiesPresenter.present({
          serverCapabilities
        });
      })
  }
);
