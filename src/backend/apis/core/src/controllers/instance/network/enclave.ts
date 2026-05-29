import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { subspaceEnclaveService } from '@metorial/module-subspace';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { enclavePresenter } from '../../../presenters';

let networkReadScopes = ['instance.network:read'] as const;

export let enclaveGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.enclaveId) {
    throw new ServiceError(
      badRequestError({
        message: 'enclaveId is required',
        description: 'The enclaveId path parameter is required.'
      })
    );
  }

  let enclave = await subspaceEnclaveService.get({
    instance: ctx.instance,
    enclaveId: ctx.params.enclaveId
  });

  return { enclave };
});

export let enclaveController = Controller.create(
  {
    name: 'Enclaves',
    description: 'Read enclave records for provider deployments in an instance.'
  },
  {
    list: instanceGroup
      .get(instancePath('enclaves', 'enclaves.list'), {
        name: 'List enclaves',
        description: 'Returns a paginated list of enclaves.'
      })
      .use(checkAccess({ possibleScopes: [...networkReadScopes] }))
      .outputList(enclavePresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            id: v.optional(v.union([v.string(), v.array(v.string())])),
            slug: v.optional(v.union([v.string(), v.array(v.string())])),
            network_id: v.optional(v.union([v.string(), v.array(v.string())])),
            provider_deployment_id: v.optional(v.union([v.string(), v.array(v.string())])),
            provider_id: v.optional(v.union([v.string(), v.array(v.string())])),
            firewall_id: v.optional(v.union([v.string(), v.array(v.string())])),
            created_at: dateFilterValidator('enclave creation time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceEnclaveService.list({
          instance: ctx.instance,
          ids: normalizeArrayParam(ctx.query.id),
          slugs: normalizeArrayParam(ctx.query.slug),
          networkIds: normalizeArrayParam(ctx.query.network_id),
          providerDeploymentIds: normalizeArrayParam(ctx.query.provider_deployment_id),
          providerIds: normalizeArrayParam(ctx.query.provider_id),
          firewallIds: normalizeArrayParam(ctx.query.firewall_id),
          createdAt: ctx.query.created_at
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, enclave =>
          enclavePresenter.present({
            enclave
          })
        );
      }),

    get: enclaveGroup
      .get(instancePath('enclaves/:enclaveId', 'enclaves.get'), {
        name: 'Get enclave',
        description: 'Retrieves a specific enclave by ID.'
      })
      .use(checkAccess({ possibleScopes: [...networkReadScopes] }))
      .output(enclavePresenter)
      .do(async ctx => enclavePresenter.present({ enclave: ctx.enclave }))
  }
);
