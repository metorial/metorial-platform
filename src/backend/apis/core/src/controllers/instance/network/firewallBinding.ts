import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { subspaceFirewallBindingService } from '@metorial/module-subspace';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instancePath } from '../../../middleware/instanceGroup';
import { networkInstanceGroup } from './_middleware';
import { firewallBindingPresenter } from '../../../presenters';
import { firewallBindingTargetValidator } from './_validators';

let networkReadScopes = ['instance.network:read'] as const;
let networkWriteScopes = ['instance.network:write'] as const;

export let firewallBindingGroup = networkInstanceGroup.use(async ctx => {
  if (!ctx.params.firewallBindingId) {
    throw new ServiceError(
      badRequestError({
        message: 'firewallBindingId is required',
        description: 'The firewallBindingId path parameter is required.'
      })
    );
  }

  let firewallBinding = await subspaceFirewallBindingService.get({
    instance: ctx.instance,
    firewallBindingId: ctx.params.firewallBindingId
  });

  return { firewallBinding };
});

export let firewallBindingController = Controller.create(
  {
    name: 'Firewall Bindings',
    description: 'Manage bindings that apply firewalls to enclaves, providers, or networks.'
  },
  {
    list: networkInstanceGroup
      .get(instancePath('firewall-bindings', 'firewallBindings.list'), {
        name: 'List firewall bindings',
        description: 'Returns a paginated list of firewall bindings.'
      })
      .use(checkAccess({ possibleScopes: [...networkReadScopes] }))
      .outputList(firewallBindingPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            id: v.optional(v.union([v.string(), v.array(v.string())])),
            firewall_id: v.optional(v.union([v.string(), v.array(v.string())])),
            enclave_id: v.optional(v.union([v.string(), v.array(v.string())])),
            provider_id: v.optional(v.union([v.string(), v.array(v.string())])),
            network_id: v.optional(v.union([v.string(), v.array(v.string())])),
            target_type: v.optional(
              v.union([
                v.enumOf(['enclave', 'provider', 'network']),
                v.array(v.enumOf(['enclave', 'provider', 'network']))
              ])
            ),
            created_at: dateFilterValidator('firewall binding creation time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceFirewallBindingService.list({
          instance: ctx.instance,
          ids: normalizeArrayParam(ctx.query.id),
          firewallIds: normalizeArrayParam(ctx.query.firewall_id),
          enclaveIds: normalizeArrayParam(ctx.query.enclave_id),
          providerIds: normalizeArrayParam(ctx.query.provider_id),
          networkIds: normalizeArrayParam(ctx.query.network_id),
          targetTypes: normalizeArrayParam(ctx.query.target_type),
          createdAt: ctx.query.created_at
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, firewallBinding =>
          firewallBindingPresenter.present({
            firewallBinding
          })
        );
      }),

    get: firewallBindingGroup
      .get(instancePath('firewall-bindings/:firewallBindingId', 'firewallBindings.get'), {
        name: 'Get firewall binding',
        description: 'Retrieves a specific firewall binding by ID.'
      })
      .use(checkAccess({ possibleScopes: [...networkReadScopes] }))
      .output(firewallBindingPresenter)
      .do(async ctx =>
        firewallBindingPresenter.present({ firewallBinding: ctx.firewallBinding })
      ),

    create: networkInstanceGroup
      .post(instancePath('firewall-bindings', 'firewallBindings.create'), {
        name: 'Create firewall binding',
        description: 'Creates a binding that applies a firewall to a target.'
      })
      .use(checkAccess({ possibleScopes: [...networkWriteScopes] }))
      .body(
        'default',
        v.intersection([
          v.object({
            firewall_id: v.string()
          }),
          firewallBindingTargetValidator
        ])
      )
      .output(firewallBindingPresenter)
      .do(async ctx => {
        let firewallBinding = await subspaceFirewallBindingService.create({
          instance: ctx.instance,
          firewallId: ctx.body.firewall_id,
          targetType: ctx.body.target_type,
          enclaveId: ctx.body.enclave_id,
          providerId: ctx.body.provider_id,
          networkId: ctx.body.network_id
        });

        return firewallBindingPresenter.present({ firewallBinding });
      }),

    delete: firewallBindingGroup
      .delete(
        instancePath('firewall-bindings/:firewallBindingId', 'firewallBindings.delete'),
        {
          name: 'Delete firewall binding',
          description: 'Deletes a firewall binding.'
        }
      )
      .use(checkAccess({ possibleScopes: [...networkWriteScopes] }))
      .output(firewallBindingPresenter)
      .do(async ctx => {
        let firewallBinding = ctx.firewallBinding;

        await subspaceFirewallBindingService.delete({
          instance: ctx.instance,
          firewallBindingId: firewallBinding.id
        });

        return firewallBindingPresenter.present({ firewallBinding });
      })
  }
);
