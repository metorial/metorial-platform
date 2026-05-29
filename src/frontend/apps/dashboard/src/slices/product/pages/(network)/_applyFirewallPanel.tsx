import { renderWithPagination } from '@metorial/data-hooks';
import {
  useCreateFirewallBinding,
  useDeleteFirewallBinding,
  useFirewallBindings,
  useFirewalls
} from '@metorial/state';
import { Checkbox, Panel, Text, showModal } from '@metorial/ui';
import { Table } from '@metorial/ui-product';
import { statusBadge } from './_common';

let targetMatches = (
  binding: {
    target: { id: string } | null;
  },
  targetId: string
) => binding.target?.id === targetId;

export let showApplyFirewallPanel = (p: {
  instanceId: string;
  targetType: 'network' | 'enclave';
  targetId: string;
  title: string;
  description: string;
  onComplete: () => void;
}) =>
  showModal(({ dialogProps }) => {
    let firewalls = useFirewalls(p.instanceId, { limit: 10, order: 'desc' });
    let firewallBindings = useFirewallBindings(p.instanceId, { limit: 100, order: 'desc' });
    let createBinding = useCreateFirewallBinding();
    let deleteBinding = useDeleteFirewallBinding();

    return (
      <Panel.Wrapper {...dialogProps} width={760}>
        <Panel.Header>
          <Panel.Title>{p.title}</Panel.Title>
          <Panel.Description>{p.description}</Panel.Description>
        </Panel.Header>

        <Panel.Content>
          {renderWithPagination(firewalls)(firewalls => {
            let targetBindings = (firewallBindings.data?.items ?? []).filter(binding =>
              targetMatches(binding, p.targetId)
            );

            return (
              <Table
                headers={['', 'Firewall', 'Status', 'Policies']}
                data={firewalls.data.items.map(firewall => {
                  let binding = targetBindings.find(binding => binding.firewall.id === firewall.id);
                  let isApplied = !!binding;

                  return {
                    data: [
                      <Checkbox
                        label={`Apply ${firewall.name}`}
                        hideLabel
                        checked={isApplied}
                        disabled={!firewallBindings.data || (!isApplied && firewall.status !== 'active')}
                        onCheckedChange={async checked => {
                          if (checked && !binding) {
                            await createBinding.mutate({
                              instanceId: p.instanceId,
                              firewallId: firewall.id,
                              targetType: p.targetType,
                              ...(p.targetType === 'network'
                                ? { networkId: p.targetId }
                                : { enclaveId: p.targetId })
                            });
                          }

                          if (!checked && binding) {
                            await deleteBinding.mutate({
                              instanceId: p.instanceId,
                              firewallBindingId: binding.id
                            });
                          }

                          firewallBindings.refetch();
                          p.onComplete();
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
          })}
        </Panel.Content>
      </Panel.Wrapper>
    );
  });
