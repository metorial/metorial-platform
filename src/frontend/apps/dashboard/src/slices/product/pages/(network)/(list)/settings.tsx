import { renderWithLoader } from '@metorial/data-hooks';
import {
  useCurrentInstance,
  useDeleteFirewallBinding,
  useFirewallBindings,
  useNetworks
} from '@metorial/state';
import { Button, Menu, RenderDate, Spacer, Text } from '@metorial/ui';
import { Box, ID, Table } from '@metorial/ui-product';
import { RiMore2Line } from '@remixicon/react';
import { showApplyFirewallPanel } from '../_applyFirewallPanel';
import { EmptyText } from '../_common';
import { useNetworkManagementAccess } from '../_gate';

export let NetworkSettingsPage = () => {
  let instance = useCurrentInstance();
  let { canWrite } = useNetworkManagementAccess();
  let networks = useNetworks(instance.data?.id, { limit: 100, order: 'desc' });
  let firewallBindings = useFirewallBindings(instance.data?.id, { limit: 100, order: 'desc' });
  let deleteBinding = useDeleteFirewallBinding();

  return renderWithLoader({ networks, firewallBindings })(({ networks, firewallBindings }) => {
    let network = networks.data.items[0];
    let networkBindings = firewallBindings.data.items.filter(
      binding => binding.target?.id === network?.id
    );

    return (
      <>
        <Box
          title="Metorial Magic Network"
          description="The network all your providers run in."
        >
          {network ? (
            <Table
              headers={['Name', 'ID', 'Created', 'Updated']}
              data={[
                {
                  data: [
                    <Text size="2" weight="strong">
                      {network.name}
                    </Text>,
                    <ID id={network.id} />,
                    <RenderDate date={network.createdAt} />,
                    <RenderDate date={network.updatedAt} />
                  ]
                }
              ]}
            />
          ) : (
            <EmptyText>No default network found.</EmptyText>
          )}
        </Box>

        <Spacer size={20} />

        <Box
          title="Applied Firewalls"
          description="Firewall bindings that apply to the default network."
          rightActions={
            network && canWrite ?
              <Button
                size="2"
                onClick={() =>
                  showApplyFirewallPanel({
                    instanceId: instance.data!.id,
                    targetType: 'network',
                    targetId: network.id,
                    title: 'Apply Firewall',
                    description:
                      'Choose the firewalls that should apply to the default network.',
                    onComplete: () => firewallBindings.refetch()
                  })
                }
              >
                Apply Firewall
              </Button>
            : undefined
          }
        >
          {networkBindings.length > 0 ? (
            <Table
              headers={['Firewall', 'Target', 'Created', '']}
              data={networkBindings.map(binding => ({
                data: [
                  <Text size="2" weight="strong">
                    {binding.firewall.name}
                  </Text>,
                  <Text size="2">{binding.target?.name ?? 'Default network'}</Text>,
                  <RenderDate date={binding.createdAt} />,
                  canWrite ?
                    <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
                      <Menu
                        items={[{ id: 'remove', label: 'Remove' }]}
                        onItemClick={async item => {
                          if (item !== 'remove') return;

                          await deleteBinding.mutate({
                            instanceId: instance.data!.id,
                            firewallBindingId: binding.id
                          });
                          firewallBindings.refetch();
                        }}
                      >
                        <Button
                          size="1"
                          variant="outline"
                          iconLeft={<RiMore2Line />}
                          title="Firewall actions"
                        />
                      </Menu>
                    </div>
                  : null
                ]
              }))}
            />
          ) : (
            <EmptyText>No firewalls are applied to the default network.</EmptyText>
          )}
        </Box>
      </>
    );
  });
};
