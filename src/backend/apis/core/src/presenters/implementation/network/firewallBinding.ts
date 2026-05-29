import { v } from '@lowerdeck/validation';
import { SubspaceFirewallBinding } from '@metorial/module-subspace';
import { Presenter } from '@metorial/presenter';
import { firewallBindingType } from '../../types';

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

let presentBindingTarget = (firewallBinding: SubspaceFirewallBinding) => {
  if (!firewallBinding.target) return null;

  return {
    object: 'network.firewall.binding.target#preview' as const,
    type: firewallBinding.targetType,
    id: firewallBinding.target.id,
    name: firewallBinding.target.name
  };
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
