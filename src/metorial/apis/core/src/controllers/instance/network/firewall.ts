import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { firewallService, type FirewallBindingInput } from '@metorial-subspace/module-enclave';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instancePath } from '../../../middleware/instanceGroup';
import { networkInstanceGroup } from './_middleware';
import { firewallPresenter } from '@metorial/presenters';
import { firewallBindingTargetValidator } from './_validators';

let networkReadScopes = ['instance.network:read'] as const;
let networkWriteScopes = ['instance.network:write'] as const;

export let firewallGroup = networkInstanceGroup.use(async ctx => {
  if (!ctx.params.firewallId) {
    throw new ServiceError(
      badRequestError({
        message: 'firewallId is required',
        description: 'The firewallId path parameter is required.'
      })
    );
  }

  let firewall = await firewallService.getFirewallById({
    instance: ctx.instance,
    firewallId: ctx.params.firewallId,
    allowDeleted: true
  });

  return { firewall };
});

export let firewallController = Controller.create(
  {
    name: 'Firewalls',
    description: 'Manage firewalls and their attached network policies.'
  },
  {
    list: networkInstanceGroup
      .get(instancePath('firewalls', 'firewalls.list'), {
        name: 'List firewalls',
        description: 'Returns a paginated list of firewalls.'
      })
      .use(checkAccess({ possibleScopes: [...networkReadScopes] }))
      .outputList(firewallPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            id: v.optional(v.union([v.string(), v.array(v.string())])),
            slug: v.optional(v.union([v.string(), v.array(v.string())])),
            status: v.optional(
              v.union([
                v.enumOf(['active', 'archived', 'deleted']),
                v.array(v.enumOf(['active', 'archived', 'deleted']))
              ])
            ),
            network_id: v.optional(v.union([v.string(), v.array(v.string())])),
            enclave_id: v.optional(v.union([v.string(), v.array(v.string())])),
            provider_id: v.optional(v.union([v.string(), v.array(v.string())])),
            network_policy_id: v.optional(v.union([v.string(), v.array(v.string())])),
            created_at: dateFilterValidator('firewall creation time'),
            updated_at: dateFilterValidator('firewall last update time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await firewallService.listFirewalls({
          instance: ctx.instance,
          allowDeleted: true,
          ids: normalizeArrayParam(ctx.query.id),
          slugs: normalizeArrayParam(ctx.query.slug),
          status: normalizeArrayParam(ctx.query.status),
          networkIds: normalizeArrayParam(ctx.query.network_id),
          enclaveIds: normalizeArrayParam(ctx.query.enclave_id),
          providerIds: normalizeArrayParam(ctx.query.provider_id),
          networkPolicyIds: normalizeArrayParam(ctx.query.network_policy_id),
          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, firewall =>
          firewallPresenter.present({
            firewall
          })
        );
      }),

    get: firewallGroup
      .get(instancePath('firewalls/:firewallId', 'firewalls.get'), {
        name: 'Get firewall',
        description: 'Retrieves a specific firewall by ID.'
      })
      .use(checkAccess({ possibleScopes: [...networkReadScopes] }))
      .output(firewallPresenter)
      .do(async ctx => firewallPresenter.present({ firewall: ctx.firewall })),

    create: networkInstanceGroup
      .post(instancePath('firewalls', 'firewalls.create'), {
        name: 'Create firewall',
        description: 'Creates a new firewall.'
      })
      .use(checkAccess({ possibleScopes: [...networkWriteScopes] }))
      .body(
        'default',
        v.object({
          name: v.string(),
          description: v.optional(v.string()),
          slug: v.optional(v.string()),
          network_id: v.string(),
          bindings: v.optional(v.array(firewallBindingTargetValidator)),
          network_policy_ids: v.optional(v.array(v.string()))
        })
      )
      .output(firewallPresenter)
      .do(async ctx => {
        let firewall = await firewallService.createFirewall({
          instance: ctx.instance,
          auditScope: ctx.auditScope,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            slug: ctx.body.slug,
            networkId: ctx.body.network_id,
            bindings: ctx.body.bindings?.map(binding => ({
              targetType: binding.target_type,
              enclaveId: binding.enclave_id,
              providerId: binding.provider_id,
              networkId: binding.network_id
            })) as FirewallBindingInput[] | undefined,
            networkPolicyIds: ctx.body.network_policy_ids
          }
        });

        return firewallPresenter.present({ firewall });
      }),

    update: firewallGroup
      .patch(instancePath('firewalls/:firewallId', 'firewalls.update'), {
        name: 'Update firewall',
        description: 'Updates a firewall definition.'
      })
      .use(checkAccess({ possibleScopes: [...networkWriteScopes] }))
      .body(
        'default',
        v.object({
          name: v.optional(v.string()),
          description: v.optional(v.string()),
          slug: v.optional(v.string()),
          network_policy_ids: v.optional(v.array(v.string()))
        })
      )
      .output(firewallPresenter)
      .do(async ctx => {
        let firewall = await firewallService.updateFirewall({
          instance: ctx.instance,
          auditScope: ctx.auditScope,
          firewall: ctx.firewall,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            slug: ctx.body.slug,
            networkPolicyIds: ctx.body.network_policy_ids
          }
        });

        return firewallPresenter.present({ firewall });
      }),

    delete: firewallGroup
      .delete(instancePath('firewalls/:firewallId', 'firewalls.delete'), {
        name: 'Delete firewall',
        description: 'Archives a firewall.'
      })
      .use(checkAccess({ possibleScopes: [...networkWriteScopes] }))
      .output(firewallPresenter)
      .do(async ctx => {
        await firewallService.archiveFirewall({
          instance: ctx.instance,
          auditScope: ctx.auditScope,
          firewall: ctx.firewall
        });

        let firewall = await firewallService.getFirewallById({
          instance: ctx.instance,
          firewallId: ctx.firewall.id,
          allowDeleted: true
        });

        return firewallPresenter.present({ firewall });
      }),

    attachNetworkPolicy: firewallGroup
      .post(
        instancePath(
          'firewalls/:firewallId/network-policies',
          'firewalls.networkPolicies.attach'
        ),
        {
          name: 'Attach network policy',
          description: 'Attaches a network policy to a firewall.'
        }
      )
      .use(checkAccess({ possibleScopes: [...networkWriteScopes] }))
      .body(
        'default',
        v.object({
          network_policy_id: v.string(),
          position: v.optional(v.number())
        })
      )
      .output(firewallPresenter)
      .do(async ctx => {
        let firewall = await firewallService.addFirewallNetworkPolicy({
          instance: ctx.instance,
          auditScope: ctx.auditScope,
          firewall: ctx.firewall,
          networkPolicyId: ctx.body.network_policy_id,
          position: ctx.body.position
        });

        return firewallPresenter.present({ firewall });
      }),

    detachNetworkPolicy: firewallGroup
      .delete(
        instancePath(
          'firewalls/:firewallId/network-policies/:networkPolicyId',
          'firewalls.networkPolicies.detach'
        ),
        {
          name: 'Detach network policy',
          description: 'Detaches a network policy from a firewall.'
        }
      )
      .use(checkAccess({ possibleScopes: [...networkWriteScopes] }))
      .output(firewallPresenter)
      .do(async ctx => {
        let firewall = await firewallService.removeFirewallNetworkPolicy({
          instance: ctx.instance,
          auditScope: ctx.auditScope,
          firewall: ctx.firewall,
          networkPolicyId: ctx.params.networkPolicyId
        });

        return firewallPresenter.present({ firewall });
      })
  }
);
