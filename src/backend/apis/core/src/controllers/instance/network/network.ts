import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { subspaceNetworkService } from '@metorial/module-subspace';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { networkPresenter } from '../../../presenters';

let networkReadScopes = ['instance.network:read'] as const;

export let networkGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.networkId) {
    throw new ServiceError(
      badRequestError({
        message: 'networkId is required',
        description: 'The networkId path parameter is required.'
      })
    );
  }

  let network = await subspaceNetworkService.get({
    instance: ctx.instance,
    networkId: ctx.params.networkId
  });

  return { network };
});

export let networkController = Controller.create(
  {
    name: 'Networks',
    description: 'Read network records for an instance environment.'
  },
  {
    list: instanceGroup
      .get(instancePath('networks', 'networks.list'), {
        name: 'List networks',
        description: 'Returns a paginated list of networks.'
      })
      .use(checkAccess({ possibleScopes: [...networkReadScopes] }))
      .outputList(networkPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            id: v.optional(v.union([v.string(), v.array(v.string())])),
            firewall_id: v.optional(v.union([v.string(), v.array(v.string())])),
            enclave_id: v.optional(v.union([v.string(), v.array(v.string())])),
            created_at: dateFilterValidator('network creation time'),
            updated_at: dateFilterValidator('network last update time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceNetworkService.list({
          instance: ctx.instance,
          ids: normalizeArrayParam(ctx.query.id),
          firewallIds: normalizeArrayParam(ctx.query.firewall_id),
          enclaveIds: normalizeArrayParam(ctx.query.enclave_id),
          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, network =>
          networkPresenter.present({
            network
          })
        );
      }),

    get: networkGroup
      .get(instancePath('networks/:networkId', 'networks.get'), {
        name: 'Get network',
        description: 'Retrieves a specific network by ID.'
      })
      .use(checkAccess({ possibleScopes: [...networkReadScopes] }))
      .output(networkPresenter)
      .do(async ctx => networkPresenter.present({ network: ctx.network }))
  }
);
