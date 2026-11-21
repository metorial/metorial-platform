import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { firewallService } from '@metorial/module-networking';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instancePath } from '../../../middleware/instanceGroup';
import { networkingInstanceGroup } from './_middleware';
import { firewallPresenter } from '@metorial/presenters';

let networkReadScopes = ['instance.network:read'] as const;
let networkWriteScopes = ['instance.network:write'] as const;

export let firewallGroup = networkingInstanceGroup.use(async ctx => {
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
    description:
      'A firewall is a set of network policies applied to targets. Firewalls apply to integration enclaves, providers, and sandbox machines.'
  },
  {
    list: networkingInstanceGroup
      .get(instancePath('firewalls', 'firewalls.list'), {
        name: 'List firewalls',
        description: 'Returns a paginated list of firewalls in the instance.'
      })
      .use(checkAccess({ possibleScopes: [...networkReadScopes] }))
      .outputList(firewallPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            search: v.optional(v.string(), {
              description: 'Filter firewalls by name or description.'
            }),
            id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Only return firewalls with one of these IDs.'
            }),
            slug: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Only return firewalls with one of these slugs.'
            }),
            status: v.optional(
              v.union([
                v.enumOf(['active', 'archived', 'deleted']),
                v.array(v.enumOf(['active', 'archived', 'deleted']))
              ]),
              {
                description: 'Only return firewalls with one of these statuses.'
              }
            ),
            enclave_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Only return firewalls applied to one of these enclaves.'
            }),
            provider_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Only return firewalls applied to one of these providers.'
            }),
            network_policy_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Only return firewalls with one of these network policies attached.'
            }),
            machine_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Only return firewalls applied to one of these sandbox machines.'
            }),
            created_at: dateFilterValidator('firewall creation time'),
            updated_at: dateFilterValidator('firewall last update time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await firewallService.listFirewalls({
          instance: ctx.instance,
          allowDeleted: false,
          search: ctx.query.search,
          ids: normalizeArrayParam(ctx.query.id),
          slugs: normalizeArrayParam(ctx.query.slug),
          status: normalizeArrayParam(ctx.query.status),
          enclaveIds: normalizeArrayParam(ctx.query.enclave_id),
          providerIds: normalizeArrayParam(ctx.query.provider_id),
          networkPolicyIds: normalizeArrayParam(ctx.query.network_policy_id),
          machineIds: normalizeArrayParam(ctx.query.machine_id),
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
        description: 'Retrieves a firewall.'
      })
      .use(checkAccess({ possibleScopes: [...networkReadScopes] }))
      .output(firewallPresenter)
      .do(async ctx => firewallPresenter.present({ firewall: ctx.firewall })),

    create: networkingInstanceGroup
      .post(instancePath('firewalls', 'firewalls.create'), {
        name: 'Create firewall',
        description: 'Creates a firewall.'
      })
      .use(checkAccess({ possibleScopes: [...networkWriteScopes] }))
      .body(
        'default',
        v.object({
          name: v.string({
            description: 'Display name.'
          }),
          description: v.optional(
            v.string({
              description: 'Free-text description.'
            })
          ),
          slug: v.optional(
            v.string({
              description:
                'URL-safe name, unique within the instance. Generated from the name when omitted.'
            })
          ),
          network_policy_ids: v.optional(
            v.array(v.string(), {
              description: 'Network policies to attach to the firewall, in order.'
            })
          )
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
            networkPolicyIds: ctx.body.network_policy_ids
          }
        });

        return firewallPresenter.present({ firewall });
      }),

    update: firewallGroup
      .patch(instancePath('firewalls/:firewallId', 'firewalls.update'), {
        name: 'Update firewall',
        description: 'Updates a firewall. Omitted fields keep their current value.'
      })
      .use(checkAccess({ possibleScopes: [...networkWriteScopes] }))
      .body(
        'default',
        v.object({
          name: v.optional(
            v.string({
              description: 'Display name.'
            })
          ),
          description: v.optional(
            v.string({
              description: 'Free-text description.'
            })
          ),
          slug: v.optional(
            v.string({
              description: 'URL-safe name, unique within the instance.'
            })
          ),
          network_policy_ids: v.optional(
            v.array(v.string(), {
              description:
                'Network policies attached to the firewall, in order. Replaces existing attachments.'
            })
          )
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
        name: 'Archive firewall',
        description: 'Archives a firewall. It stays listable with `status=archived`.'
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
          network_policy_id: v.string({
            description: 'Network policy to attach to the firewall.'
          }),
          position: v.optional(
            v.number({
              description: 'Position to insert the policy at. Omitted appends it last.'
            })
          )
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
