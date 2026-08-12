import { v } from '@lowerdeck/validation';
import type { Prisma } from '@metorial-subspace/db';
import { Presenter } from '@metorial/presenter';
import { firewallBindingType } from '../../types';

type FirewallBindingRecord = Prisma.FirewallBindingGetPayload<{
  include: {
    firewall: { select: { id: true; slug: true; name: true } };
    enclave: { select: { id: true; slug: true; name: true } };
    provider: {
      select: { id: true; slug: true; name: true; prettySlug: true };
    };
    network: { select: { id: true; name: true } };
  };
}>;

let firewallPreviewSchema = v.object({
  object: v.literal('network.firewall#preview'),
  id: v.string(),
  slug: v.string(),
  name: v.string()
});

let bindingTargetPreviewSchema = v.object({
  object: v.literal('network.firewall.binding.target#preview'),
  type: v.enumOf(['enclave', 'provider', 'network']),
  id: v.string(),
  name: v.string()
});

let presentBindingTarget = (firewallBinding: FirewallBindingRecord) => {
  if (firewallBinding.targetType === 'enclave' && firewallBinding.enclave) {
    return {
      object: 'network.firewall.binding.target#preview' as const,
      type: firewallBinding.targetType,
      id: firewallBinding.enclave.id,
      name: firewallBinding.enclave.name
    };
  }

  if (firewallBinding.targetType === 'provider' && firewallBinding.provider) {
    return {
      object: 'network.firewall.binding.target#preview' as const,
      type: firewallBinding.targetType,
      id: firewallBinding.provider.id,
      name: firewallBinding.provider.name
    };
  }

  if (firewallBinding.targetType === 'network' && firewallBinding.network) {
    return {
      object: 'network.firewall.binding.target#preview' as const,
      type: firewallBinding.targetType,
      id: firewallBinding.network.id,
      name: firewallBinding.network.name
    };
  }

  return null;
};

export let v1FirewallBindingPresenter = Presenter.create(firewallBindingType)
  .presenter(async ({ firewallBinding }) => ({
    object: 'network.firewall.binding' as const,
    id: firewallBinding.id,
    target_type: firewallBinding.targetType,
    firewall: {
      object: 'network.firewall#preview' as const,
      id: firewallBinding.firewall.id,
      slug: firewallBinding.firewall.slug,
      name: firewallBinding.firewall.name
    },
    target: presentBindingTarget(firewallBinding),
    created_at: firewallBinding.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('network.firewall.binding'),
      id: v.string(),
      target_type: v.enumOf(['enclave', 'provider', 'network']),
      firewall: firewallPreviewSchema,
      target: v.nullable(bindingTargetPreviewSchema),
      created_at: v.date()
    })
  )
  .build();
