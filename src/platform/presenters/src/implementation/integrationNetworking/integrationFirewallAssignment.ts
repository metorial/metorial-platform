import { v } from '@lowerdeck/validation';
import type { Prisma } from '@metorial-subspace/db';
import { Presenter } from '@metorial/presenter';
import { integrationFirewallAssignmentType } from '../../types';

type IntegrationFirewallAssignmentRecord = Prisma.IntegrationFirewallAssignmentGetPayload<{
  include: {
    firewall: { select: { id: true; slug: true; name: true } };
    enclave: { select: { id: true; slug: true; name: true } };
    provider: {
      select: { id: true; slug: true; name: true; prettySlug: true };
    };
    internetGateway: { select: { id: true; name: true } };
  };
}>;

let targetTypes = ['enclave', 'provider', 'internet_gateway'] as const;

let firewallPreviewSchema = v.object(
  {
    object: v.literal('networking.firewall#preview', {
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
    })
  },
  {
    description: 'Firewall applied to the target.'
  }
);

let assignmentTargetPreviewSchema = v.object(
  {
    object: v.literal('integration.firewall_assignment.target#preview', {
      description: 'String representing the object’s type.'
    }),
    type: v.enumOf([...targetTypes], {
      description: 'Kind of target the firewall applies to.'
    }),
    id: v.string({
      description: 'Unique ID.'
    }),
    name: v.string({
      description: 'Display name.'
    })
  },
  {
    description: 'Target the firewall applies to. `null` when the target no longer exists.'
  }
);

let presentAssignmentTarget = (assignment: IntegrationFirewallAssignmentRecord) => {
  if (assignment.targetType === 'enclave' && assignment.enclave) {
    return {
      object: 'integration.firewall_assignment.target#preview' as const,
      type: assignment.targetType,
      id: assignment.enclave.id,
      name: assignment.enclave.name
    };
  }

  if (assignment.targetType === 'provider' && assignment.provider) {
    return {
      object: 'integration.firewall_assignment.target#preview' as const,
      type: assignment.targetType,
      id: assignment.provider.id,
      name: assignment.provider.name
    };
  }

  if (assignment.targetType === 'internet_gateway' && assignment.internetGateway) {
    return {
      object: 'integration.firewall_assignment.target#preview' as const,
      type: assignment.targetType,
      id: assignment.internetGateway.id,
      name: assignment.internetGateway.name
    };
  }

  return null;
};

export let v1IntegrationFirewallAssignmentPresenter = Presenter.create(
  integrationFirewallAssignmentType
)
  .presenter(async ({ firewallAssignment }) => ({
    object: 'integration.firewall_assignment' as const,
    id: firewallAssignment.id,
    target_type: firewallAssignment.targetType,
    firewall: {
      object: 'networking.firewall#preview' as const,
      id: firewallAssignment.firewall.id,
      slug: firewallAssignment.firewall.slug,
      name: firewallAssignment.firewall.name
    },
    target: presentAssignmentTarget(firewallAssignment),
    created_at: firewallAssignment.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('integration.firewall_assignment', {
        description: 'String representing the object’s type.'
      }),
      id: v.string({
        description: 'Unique ID.'
      }),
      target_type: v.enumOf([...targetTypes], {
        description: 'What the firewall applies to.'
      }),
      firewall: firewallPreviewSchema,
      target: v.nullable(assignmentTargetPreviewSchema),
      created_at: v.date({
        description: 'Creation time.'
      })
    })
  )
  .build();
