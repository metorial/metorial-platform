import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { integrationEnclaveService } from '@metorial-subspace/module-enclave';
import { Controller, Path } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instancePath } from '../../../middleware/instanceGroup';
import { networkingInstanceGroup } from '../networking/_middleware';
import { isDashboardGroup } from '../../../middleware/isDashboard';
import { integrationEnclavePresenter } from '@metorial/presenters';

let networkReadScopes = ['instance.network:read'] as const;

export let integrationEnclaveGroup = networkingInstanceGroup.use(async ctx => {
  if (!ctx.params.integrationEnclaveId) {
    throw new ServiceError(
      badRequestError({
        message: 'integrationEnclaveId is required',
        description: 'The integrationEnclaveId path parameter is required.'
      })
    );
  }

  let enclave = await integrationEnclaveService.getEnclaveById({
    instance: ctx.instance,
    enclaveId: ctx.params.integrationEnclaveId
  });

  return { enclave };
});

export let integrationEnclaveController = Controller.create(
  {
    name: 'Integration Enclaves',
    description:
      'An integration enclave is the isolated network a provider deployment runs in. It connects the deployment to its internet gateway and firewalls.'
  },
  {
    list: networkingInstanceGroup
      .get(instancePath('integration-enclaves', 'integrationEnclaves.list'), {
        name: 'List integration enclaves',
        description: 'Returns a paginated list of integration enclaves in the instance.'
      })
      .use(checkAccess({ possibleScopes: [...networkReadScopes] }))
      .outputList(integrationEnclavePresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Only return integration enclaves with one of these IDs.'
            }),
            slug: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Only return integration enclaves with one of these slugs.'
            }),
            internet_gateway_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description:
                'Only return integration enclaves using one of these internet gateways.'
            }),
            provider_deployment_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description:
                'Only return integration enclaves running one of these provider deployments.'
            }),
            provider_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Only return integration enclaves running one of these providers.'
            }),
            firewall_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description:
                'Only return integration enclaves protected by one of these firewalls.'
            }),
            created_at: dateFilterValidator('integration enclave creation time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await integrationEnclaveService.listEnclaves({
          instance: ctx.instance,
          ids: normalizeArrayParam(ctx.query.id),
          slugs: normalizeArrayParam(ctx.query.slug),
          internetGatewayIds: normalizeArrayParam(ctx.query.internet_gateway_id),
          providerDeploymentIds: normalizeArrayParam(ctx.query.provider_deployment_id),
          providerIds: normalizeArrayParam(ctx.query.provider_id),
          firewallIds: normalizeArrayParam(ctx.query.firewall_id),
          createdAt: ctx.query.created_at
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, enclave =>
          integrationEnclavePresenter.present({
            enclave
          })
        );
      }),

    get: integrationEnclaveGroup
      .get(
        instancePath('integration-enclaves/:integrationEnclaveId', 'integrationEnclaves.get'),
        {
          name: 'Get integration enclave',
          description: 'Retrieves an integration enclave.'
        }
      )
      .use(checkAccess({ possibleScopes: [...networkReadScopes] }))
      .output(integrationEnclavePresenter)
      .do(async ctx => integrationEnclavePresenter.present({ enclave: ctx.enclave }))
  }
);

export let dashboardIntegrationEnclaveController = Controller.create(
  {
    name: 'Integration Enclaves (Dashboard)',
    description: 'Dashboard-only integration enclave utilities.',
    hideInDocs: true
  },
  {
    getLastUsed: networkingInstanceGroup
      .get(
        Path(
          '/dashboard/instances/:instanceId/integration-enclaves/last-used',
          'dashboard.instance.integrationEnclaves.getLastUsed'
        ),
        {
          name: 'Get last used integration enclaves',
          description: 'Returns recently used integration enclaves for dashboard filters.',
          hideInDocs: true
        }
      )
      .use(isDashboardGroup())
      .use(checkAccess({ possibleScopes: [...networkReadScopes] }))
      .outputList(integrationEnclavePresenter)
      .query(
        'default',
        v.object({
          limit: v.optional(
            v.number({
              description: 'Maximum number of enclaves to return.'
              // modifiers: [v.positive(), v.integer(), v.maxValue(100)]
            })
          )
        })
      )
      .do(async ctx => {
        let enclaves = await integrationEnclaveService.getLastUsedEnclaves({
          instance: ctx.instance,
          limit: ctx.query.limit
        });

        return Paginator.present(
          {
            items: enclaves,
            pagination: {
              hasNextPage: false,
              hasPreviousPage: false
            }
          },
          enclave => integrationEnclavePresenter.present({ enclave })
        );
      })
  }
);
