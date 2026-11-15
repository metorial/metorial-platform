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
      object: v.literal('networking.network_policy'),
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
