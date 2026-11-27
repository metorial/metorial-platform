import { renderWithLoader } from '@metorial/data-hooks';
import {
  useCreateIntegrationFirewallAssignment,
  useDeleteIntegrationFirewallAssignment,
  useFirewalls,
  useIntegrationFirewallAssignments
} from '@metorial/state';
import { Button, Checkbox, Input, Panel, Spacer, Text, showModal } from '@metorial/ui';
import styled from 'styled-components';
import { theme } from '@metorial/ui';
import { useDebounced } from '@metorial/use-debounced';
import { useEffect, useRef, useState } from 'react';
import { statusBadge } from './_common';

let FirewallRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 12px;
  border-radius: 6px;
  border: 1px solid ${theme.colors.gray300};
  margin-bottom: 8px;
  cursor: pointer;

  &[aria-checked='true'] {
    background: ${theme.colors.gray100};
  }
  &:hover {
    background: ${theme.colors.gray100};
  }
  &:focus-visible {
    outline: 2px solid ${theme.colors.gray700};
    outline-offset: 2px;
  }
  &[aria-disabled='true'] {
    opacity: 0.6;
    cursor: default;
  }
`;

let FirewallName = styled.div`
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
`;

type LocalFirewallAssignment = {
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

let toLocalBinding = (binding: LocalFirewallAssignment): LocalFirewallAssignment => ({
  id: binding.id,
  firewall: { id: binding.firewall.id },
  target: binding.target ? { id: binding.target.id } : null
});

export let showApplyFirewallPanel = (p: {
  instanceId: string;
  targetType: 'internet_gateway' | 'enclave';
  targetId: string;
  title: string;
  description: string;
  onComplete: () => void;
}) =>
  showModal(({ dialogProps }) => {
    let [search, setSearch] = useState('');
    let searchQuery = useDebounced(search.trim(), 500);
    let firewalls = useFirewalls(p.instanceId, {
      limit: 25,
      order: 'desc',
      search: searchQuery || undefined
    });
    let firewallBindings = useIntegrationFirewallAssignments(p.instanceId, {
      limit: 100,
      order: 'desc'
    });
    let createBinding = useCreateIntegrationFirewallAssignment();
    let deleteBinding = useDeleteIntegrationFirewallAssignment();

    let [localBindings, setLocalBindings] = useState<LocalFirewallAssignment[] | null>(null);
    let pendingIds = useRef(new Set<string>());
    let [pendingFirewallIds, setPendingFirewallIds] = useState<string[]>([]);

    useEffect(() => {
      if (!firewallBindings.data) return;
      setLocalBindings(
        current => current ?? firewallBindings.data?.items.map(toLocalBinding) ?? []
      );
    }, [firewallBindings.data]);

    let setFirewallPending = (firewallId: string, pending: boolean) => {
      if (pending) pendingIds.current.add(firewallId);
      else pendingIds.current.delete(firewallId);

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
          <Input
            label="Search Firewalls"
            placeholder="Search firewalls…"
            value={search}
            onChange={event => setSearch(event.target.value)}
          />
          <Spacer size={16} />
          {renderWithLoader({ firewalls, firewallBindings })(
            ({ firewalls: loadedFirewalls, firewallBindings }) => {
              let displayedFirewalls = loadedFirewalls.data.items;
              let displayedBindings =
                localBindings ?? firewallBindings.data.items.map(toLocalBinding);
              let targetBindings = displayedBindings.filter(binding =>
                targetMatches(binding, p.targetId)
              );

              return (
                <div>
                  {!displayedFirewalls.length && (
                    <Text size="2" color="gray600">
                      {searchQuery
                        ? 'No matching firewalls found.'
                        : 'No firewalls available.'}
                    </Text>
                  )}
                  {displayedFirewalls.map(firewall => {
                    let binding = targetBindings.find(
                      binding => binding.firewall.id === firewall.id
                    );
                    let isApplied = !!binding;
                    let isPending = pendingFirewallIds.includes(firewall.id);

                    let disabled = isPending || (!isApplied && firewall.status !== 'active');
                    let toggle = async () => {
                      if (disabled || pendingIds.current.has(firewall.id)) return;
                      let checked = !isApplied;
                      let previousBindings = displayedBindings;
                      setFirewallPending(firewall.id, true);

                      if (checked && !binding) {
                        let optimisticBinding: LocalFirewallAssignment = {
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
                          ...(p.targetType === 'enclave' ? { enclaveId: p.targetId } : {})
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
                          (current ?? previousBindings).filter(item => item.id !== binding.id)
                        );

                        let [, error] = await deleteBinding.mutate({
                          instanceId: p.instanceId,
                          integrationFirewallAssignmentId: binding.id
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
                    };

                    return (
                      <FirewallRow
                        key={firewall.id}
                        role="checkbox"
                        aria-label={`Apply ${firewall.name}`}
                        aria-checked={isApplied}
                        aria-disabled={disabled}
                        aria-busy={isPending}
                        tabIndex={disabled ? -1 : 0}
                        onClick={() => void toggle()}
                        onKeyDown={event => {
                          if (event.key === ' ' || event.key === 'Enter') {
                            event.preventDefault();
                            void toggle();
                          }
                        }}
                      >
                        <div aria-hidden="true" style={{ pointerEvents: 'none' }}>
                          <Checkbox
                            label={`Apply ${firewall.name}`}
                            hideLabel
                            checked={isApplied}
                            readOnly
                          />
                        </div>
                        <FirewallName>
                          <Text size="2" weight="strong">
                            {firewall.name}
                          </Text>
                          <Text as="p" size="1" color="gray600">
                            {firewall.networkPolicies.length}{' '}
                            {firewall.networkPolicies.length === 1 ? 'policy' : 'policies'}
                            {isPending ? ' · Saving…' : ''}
                          </Text>
                        </FirewallName>
                        {statusBadge(firewall.status)}
                      </FirewallRow>
                    );
                  })}
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <Button
                      variant="outline"
                      size="2"
                      disabled={
                        !loadedFirewalls.data.pagination.hasMoreBefore || firewalls.isLoading
                      }
                      onClick={firewalls.previous}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="2"
                      disabled={
                        !loadedFirewalls.data.pagination.hasMoreAfter || firewalls.isLoading
                      }
                      onClick={firewalls.next}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              );
            }
          )}

          <createBinding.RenderError />
          <deleteBinding.RenderError />
        </Panel.Content>
      </Panel.Wrapper>
    );
  });
