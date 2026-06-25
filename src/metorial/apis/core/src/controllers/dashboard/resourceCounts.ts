import { v } from '@lowerdeck/validation';
import { subspaceResourceCountService } from '@metorial/module-subspace';
import { Controller, Path } from '@metorial/rest';
import { checkAccess } from '../../middleware/checkAccess';
import { instanceGroup } from '../../middleware/instanceGroup';
import { isDashboardGroup } from '../../middleware/isDashboard';
import {
  resourceCountResourceValidator,
  type ResourceCountResource
} from '../../presenters/implementation/resourceCounts';
import { resourceCountsPresenter } from '../../presenters';

let normalizeResources = (resource: ResourceCountResource | ResourceCountResource[]) => {
  let resources = Array.isArray(resource) ? resource : [resource];
  return [...new Set(resources)];
};

export let dashboardResourceCountsController = Controller.create(
  {
    name: 'Resource Counts',
    description: 'Read dashboard resource counts for an instance.',
    hideInDocs: true
  },
  {
    get: instanceGroup
      .use(isDashboardGroup())
      .get(
        Path(
          '/dashboard/instances/:instanceId/resource-counts',
          'dashboard.instances.resourceCounts.get'
        ),
        {
          name: 'Get resource counts',
          description: 'Returns counts for requested dashboard resources.',
          hideInDocs: true
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider:read'] }))
      .query(
        'default',
        v.object({
          resource: v.union([
            resourceCountResourceValidator,
            v.array(resourceCountResourceValidator)
          ])
        })
      )
      .output(resourceCountsPresenter)
      .do(async ctx => {
        let resources = normalizeResources(ctx.query.resource);
        let countByResource = new Map<ResourceCountResource, number>();

        if (resources.length > 0) {
          let subspaceCounts = await subspaceResourceCountService.get({
            instance: ctx.instance,
            resource: resources
          });

          for (let resource of subspaceCounts.resources) {
            countByResource.set(resource.resource, resource.count);
          }
        }

        return resourceCountsPresenter.present({
          resources: resources.map(resource => ({
            resource,
            count: countByResource.get(resource) ?? 0
          }))
        });
      })
  }
);
