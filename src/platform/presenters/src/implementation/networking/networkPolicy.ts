import { v } from '@lowerdeck/validation';
import { functionEgressWarnings } from '@metorial/module-networking';
import { Presenter } from '@metorial/presenter';
import { networkPolicyType } from '../../types';
import { networkPolicyRuleSchema, presentNetworkPolicyRule } from './networkPolicyRule';

export let v1NetworkPolicyPresenter = Presenter.create(networkPolicyType)
  .presenter(async ({ networkPolicy }) => ({
    object: 'networking.network_policy' as const,
    id: networkPolicy.id,
    name: networkPolicy.name,
    description: networkPolicy.description,
    status: networkPolicy.status,
    version: networkPolicy.currentVersionNumber,
    rules: ((networkPolicy.currentVersion?.rules ?? []) as PrismaJson.NetworkPolicyRules).map(
      presentNetworkPolicyRule
    ),
    firewall_ids: networkPolicy.firewallLinks.map(link => link.firewall.id) as string[] | null,
    created_at: networkPolicy.createdAt,
    updated_at: networkPolicy.updatedAt,
    archived_at: networkPolicy.archivedAt
  }))
  .schema(
    v.object({
      object: v.literal('networking.network_policy', {
        description: 'String representing the object’s type.'
      }),
      id: v.string({
        description: 'Unique ID.',
        examples: ['npo_3nOpRsTuVwXyZaBc']
      }),
      name: v.string({
        description: 'Display name.'
      }),
      description: v.nullable(
        v.string({
          description: 'Free-text description.'
        })
      ),
      status: v.enumOf(['active', 'archived', 'deleted'], {
        description:
          'Current lifecycle status of the network policy. `archived` once you archive the policy.'
      }),
      version: v.number({
        description: 'Version number of the policy. Increments with every rule change.'
      }),
      rules: v.array(networkPolicyRuleSchema, {
        description: 'Rules in the current version of the network policy.'
      }),
      firewall_ids: v.nullable(
        v.array(
          v.string({
            description: 'Firewall the policy is attached to.',
            examples: ['fwl_7dEfGhJkLmNpQrSt']
          }),
          {
            description: 'Firewalls this policy is attached to.'
          }
        )
      ),
      created_at: v.date({
        description: 'Creation time.'
      }),
      updated_at: v.date({
        description: 'Last update time.'
      }),
      archived_at: v.nullable(
        v.date({
          description: 'When this was archived. `null` while active.'
        })
      )
    })
  )
  .build();

export let dashboardNetworkPolicyPresenter = Presenter.create(networkPolicyType)
  .presenter(async ({ networkPolicy }, opts) => {
    let inner = await v1NetworkPolicyPresenter.present({ networkPolicy }, opts).run();

    return {
      ...inner,
      warnings: functionEgressWarnings({
        rules: (networkPolicy.currentVersion?.rules ?? []) as PrismaJson.NetworkPolicyRules
      })
    };
  })
  .schema(
    v.object({
      ...v1NetworkPolicyPresenter.schema.properties,
      warnings: v.array(v.string(), {
        description:
          'Rules in this policy that have no effect in this deployment, for example internal address ranges in Metorial Cloud.'
      })
    }) as any
  )
  .build();
