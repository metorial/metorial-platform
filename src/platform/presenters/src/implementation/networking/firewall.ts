import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { firewallType } from '../../types';
import { presentNetworkPolicyRule } from './networkPolicyRule';

let networkPolicyPreviewSchema = v.object(
  {
    object: v.literal('networking.network_policy#preview', {
      description: 'String representing the object’s type.'
    }),
    id: v.string({
      description: 'Unique ID.',
      examples: ['npo_3nOpRsTuVwXyZaBc']
    }),
    name: v.string({
      description: 'Display name.'
    }),
    version: v.number({
      description: 'Version number of the policy. Increments with every rule change.'
    }),
    rules: v.array(
      v.object({
        object: v.literal('networking.network_policy.rule', {
          description: 'String representing the object’s type.'
        }),
        id: v.string({
          description: 'Unique ID.'
        }),
        effect: v.enumOf(['allow', 'deny'], {
          description: '`allow` permits matching traffic. `deny` blocks it.'
        }),
        direction: v.enumOf(['ingress', 'egress'], {
          description: '`ingress` matches incoming traffic. `egress` matches outgoing traffic.'
        }),
        cidrs: v.array(
          v.string({
            description: 'CIDR range the rule matches, for example `10.0.0.0/8`.'
          }),
          {
            description: 'CIDR ranges the rule matches.'
          }
        ),
        description: v.nullable(
          v.string({
            description: 'Free-text description.'
          })
        ),
        enabled: v.boolean({
          description: 'Whether the rule is enforced. Disabled rules are kept but ignored.'
        }),
        priority: v.number({
          description: 'Priority of the rule. Higher values are evaluated first.'
        }),
        ports: v.nullable(
          v.array(
            v.object({
              object: v.literal('networking.network_policy.port_range', {
                description: 'String representing the object’s type.'
              }),
              from: v.number({
                description: 'First port in the range, inclusive.'
              }),
              to: v.number({
                description: 'Last port in the range, inclusive.'
              })
            }),
            {
              description: 'Port ranges the rule matches. Omitted matches all ports.'
            }
          )
        )
      }),
      {
        description: 'Rules in the attached network policy.'
      }
    )
  },
  {
    description: 'Network policy attached to the firewall.'
  }
);

export let v1FirewallPresenter = Presenter.create(firewallType)
  .presenter(async ({ firewall }) => ({
    object: 'networking.firewall' as const,
    id: firewall.id,
    slug: firewall.slug,
    name: firewall.name,
    description: firewall.description,
    status: firewall.status,
    network_policies: firewall.networkPolicyLinks.map(({ networkPolicy }) => ({
      object: 'networking.network_policy#preview' as const,
      id: networkPolicy.id,
      name: networkPolicy.name,
      version: networkPolicy.currentVersionNumber,
      rules: (
        (networkPolicy.currentVersion?.rules ?? []) as PrismaJson.NetworkPolicyRules
      ).map(presentNetworkPolicyRule)
    })),
    created_at: firewall.createdAt,
    updated_at: firewall.updatedAt,
    archived_at: firewall.archivedAt
  }))
  .schema(
    v.object({
      object: v.literal('networking.firewall', {
        description: 'String representing the object’s type.'
      }),
      id: v.string({
        description: 'Unique ID.',
        examples: ['fwl_7dEfGhJkLmNpQrSt']
      }),
      slug: v.string({
        description: 'URL-safe name, unique within the instance.'
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
          'Current lifecycle status of the firewall. `archived` once you archive the firewall.'
      }),
      network_policies: v.array(networkPolicyPreviewSchema, {
        description: 'Network policies attached to the firewall, in position order.'
      }),
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
