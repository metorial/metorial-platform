import { renderWithLoader } from '@metorial/data-hooks';
import {
  useCreateFirewallBinding,
  useDeleteFirewallBinding,
  useFirewallBindings,
  useFirewalls
} from '@metorial/state';
import { Checkbox, Panel, Text, showModal } from '@metorial/ui';
import { Table } from '@metorial/ui-product';
import { useEffect, useState } from 'react';
import { statusBadge } from './_common';

type LocalFirewall = NonNullable<ReturnType<typeof useFirewalls>['data']>['items'][number];
type LocalFirewallBinding = {
  id: string;
  firewall: { id: string };
  target: { id: string } | null;
};

let targetMatches = (
  binding: {
    target: { id: string } | null;
  },
  targetId: string
) => binding.target?.id === targetId;

let toLocalBinding = (binding: LocalFirewallBinding): LocalFirewallBinding => ({
  id: binding.id,
  firewall: { id: binding.firewall.id },
  target: binding.target ? { id: binding.target.id } : null
});

export let showApplyFirewallPanel = (p: {
  instanceId: string;
  targetType: 'network' | 'enclave';
  targetId: string;
  title: string;
  description: string;
  onComplete: () => void;
}) =>
  showModal(({ dialogProps }) => {
    let firewalls = useFirewalls(p.instanceId, { limit: 100, order: 'desc' });
    let firewallBindings = useFirewallBindings(p.instanceId, { limit: 100, order: 'desc' });
    let createBinding = useCreateFirewallBinding();
    let deleteBinding = useDeleteFirewallBinding();

    let [localFirewalls, setLocalFirewalls] = useState<LocalFirewall[] | null>(null);
    let [localBindings, setLocalBindings] = useState<LocalFirewallBinding[] | null>(null);
    let [pendingFirewallIds, setPendingFirewallIds] = useState<string[]>([]);

    useEffect(() => {
      if (!firewalls.data) return;
      setLocalFirewalls(current => current ?? firewalls.data?.items ?? []);
    }, [firewalls.data]);

    useEffect(() => {
      if (!firewallBindings.data) return;
      setLocalBindings(
        current => current ?? firewallBindings.data?.items.map(toLocalBinding) ?? []
      );
    }, [firewallBindings.data]);

    let setFirewallPending = (firewallId: string, pending: boolean) => {
      setPendingFirewallIds(current =>
        pending
          ? [...current.filter(id => id !== firewallId), firewallId]
          : current.filter(id => id !== firewallId)
      );
    };

    return (
      <Panel.Wrapper {...dialogProps} width={760}>
        <Panel.Header>
          <Panel.Title>{p.title}</Panel.Title>
          <Panel.Description>{p.description}</Panel.Description>
        </Panel.Header>

        <Panel.Content>
          {renderWithLoader({ firewalls, firewallBindings })(
            ({ firewalls, firewallBindings }) => {
              let displayedFirewalls = localFirewalls ?? firewalls.data.items;
              let displayedBindings =
                localBindings ?? firewallBindings.data.items.map(toLocalBinding);
              let targetBindings = displayedBindings.filter(binding =>
                targetMatches(binding, p.targetId)
              );

              return (
                <Table
                  headers={['', 'Firewall', 'Status', 'Policies']}
                  data={displayedFirewalls.map(firewall => {
                    let binding = targetBindings.find(
                      binding => binding.firewall.id === firewall.id
                    );
                    let isApplied = !!binding;
                    let isPending = pendingFirewallIds.includes(firewall.id);

                    return {
                      data: [
                        <Checkbox
                          label={`Apply ${firewall.name}`}
                          hideLabel
                          checked={isApplied}
                          disabled={isPending || (!isApplied && firewall.status !== 'active')}
                          onCheckedChange={async checked => {
                            let previousBindings = displayedBindings;
                            setFirewallPending(firewall.id, true);

                            if (checked && !binding) {
                              let optimisticBinding: LocalFirewallBinding = {
                                id: `optimistic:${firewall.id}:${p.targetId}`,
                                firewall: { id: firewall.id },
                                target: { id: p.targetId }
                              };

                              setLocalBindings(current =>
                                (current ?? previousBindings)
                                  .filter(
                                    binding =>
                                      !(
                                        targetMatches(binding, p.targetId) &&
                                        binding.firewall.id === firewall.id
                                      )
                                  )
                                  .concat(optimisticBinding)
                              );

                              let [createdBinding, error] = await createBinding.mutate({
                                instanceId: p.instanceId,
                                firewallId: firewall.id,
                                targetType: p.targetType,
                                ...(p.targetType === 'network'
                                  ? { networkId: p.targetId }
                                  : { enclaveId: p.targetId })
                              });

                              if (error) {
                                setLocalBindings(current =>
                                  (current ?? [])
                                    .filter(item => item.id !== optimisticBinding.id)
                                    .filter(
                                      item =>
                                        !(
                                          targetMatches(item, p.targetId) &&
                                          item.firewall.id === firewall.id
                                        )
                                    )
                                );
                                setFirewallPending(firewall.id, false);
                                return;
                              }

                              if (createdBinding) {
                                setLocalBindings(current =>
                                  (current ?? []).map(binding =>
                                    binding.id === optimisticBinding.id
                                      ? toLocalBinding(createdBinding)
                                      : binding
                                  )
                                );
                              }

                              setFirewallPending(firewall.id, false);
                              p.onComplete();
                              return;
                            }

                            if (!checked && binding) {
                              setLocalBindings(current =>
                                (current ?? previousBindings).filter(
                                  item => item.id !== binding.id
                                )
                              );

                              let [, error] = await deleteBinding.mutate({
                                instanceId: p.instanceId,
                                firewallBindingId: binding.id
                              });

                              if (error) {
                                setLocalBindings(current => {
                                  let bindings = (current ?? []).filter(
                                    item => item.id !== binding.id
                                  );
                                  return bindings.concat(binding);
                                });
                                setFirewallPending(firewall.id, false);
                                return;
                              }

                              setFirewallPending(firewall.id, false);
                              p.onComplete();
                              return;
                            }

                            setFirewallPending(firewall.id, false);
                          }}
                        />,
                        <Text size="2" weight="strong">
                          {firewall.name}
                        </Text>,
                        statusBadge(firewall.status),
                        <Text size="2">{firewall.networkPolicies.length}</Text>
                      ]
                    };
                  })}
                />
              );
            }
          )}

          <createBinding.RenderError />
          <deleteBinding.RenderError />
        </Panel.Content>
      </Panel.Wrapper>
    );
  });
