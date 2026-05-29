import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { networkPolicyType } from '../../types';
import { networkPolicyRuleSchema, presentNetworkPolicyRule } from './networkPolicyRule';

export let v1NetworkPolicyPresenter = Presenter.create(networkPolicyType)
  .presenter(async ({ networkPolicy }) => ({
    object: 'network.policy' as const,
    id: networkPolicy.id,
    name: networkPolicy.name,
    description: networkPolicy.description,
    status: networkPolicy.status,
    version: networkPolicy.version,
    rules: networkPolicy.rules.map(presentNetworkPolicyRule),
    firewall_ids: networkPolicy.firewallIds ?? null,
    created_at: networkPolicy.createdAt,
    updated_at: networkPolicy.updatedAt,
    archived_at: networkPolicy.archivedAt
  }))
  .schema(
    v.object({
      object: v.literal('network.policy'),
      id: v.string(),
      name: v.string(),
      description: v.nullable(v.string()),
      status: v.enumOf(['active', 'archived', 'deleted']),
      version: v.number(),
      rules: v.array(networkPolicyRuleSchema),
      firewall_ids: v.nullable(v.array(v.string())),
      created_at: v.date(),
      updated_at: v.date(),
      archived_at: v.nullable(v.date())
    })
  )
  .build();
