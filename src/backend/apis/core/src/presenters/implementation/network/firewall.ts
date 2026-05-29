import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { firewallType } from '../../types';

let networkPolicyPreviewSchema = v.object({
  object: v.literal('network.policy#preview'),
  id: v.string(),
  name: v.string(),
  version: v.number(),
  rules: v.array(
    v.object({
      object: v.literal('network.policy.rule'),
      id: v.string(),
      effect: v.enumOf(['allow', 'deny']),
      direction: v.enumOf(['ingress', 'egress']),
      cidrs: v.array(v.string()),
      description: v.nullable(v.string()),
      enabled: v.boolean(),
      priority: v.number(),
      ports: v.nullable(
        v.array(
          v.object({
            object: v.literal('network.policy.port_range'),
            from: v.number(),
            to: v.number()
          })
        )
      )
    })
  )
});

export let v1FirewallPresenter = Presenter.create(firewallType)
  .presenter(async ({ firewall }) => ({
    object: 'network.firewall' as const,
    id: firewall.id,
    slug: firewall.slug,
    name: firewall.name,
    description: firewall.description,
    status: firewall.status,
    network_id: firewall.networkId,
    network_policies: firewall.networkPolicies.map(policy => ({
      object: 'network.policy#preview' as const,
      id: policy.id,
      name: policy.name,
      version: policy.version,
      rules: policy.rules.map(rule => ({
        object: 'network.policy.rule' as const,
        id: rule.id,
        effect: rule.effect,
        direction: rule.direction,
        cidrs: rule.cidrs,
        description: rule.description ?? null,
        enabled: rule.enabled,
        priority: rule.priority,
        ports:
          rule.ports?.map(port => ({
            object: 'network.policy.port_range' as const,
            from: port.from,
            to: port.to
          })) ?? null
      }))
    })),
    created_at: firewall.createdAt,
    updated_at: firewall.updatedAt,
    archived_at: firewall.archivedAt
  }))
  .schema(
    v.object({
      object: v.literal('network.firewall'),
      id: v.string(),
      slug: v.string(),
      name: v.string(),
      description: v.nullable(v.string()),
      status: v.enumOf(['active', 'archived', 'deleted']),
      network_id: v.string(),
      network_policies: v.array(networkPolicyPreviewSchema),
      created_at: v.date(),
      updated_at: v.date(),
      archived_at: v.nullable(v.date())
    })
  )
  .build();
