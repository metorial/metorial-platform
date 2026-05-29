import { renderWithLoader } from '@metorial/data-hooks';
import {
  useCurrentInstance,
  useDeleteFirewallBinding,
  useEnclaves,
  useFirewallBindings,
  useNetworkLogs,
  useProviderDeployment
} from '@metorial/state';
import { Button, Menu, RenderDate, Text } from '@metorial/ui';
import { Box, Table } from '@metorial/ui-product';
import { RiMore2Line } from '@remixicon/react';
import { useParams } from 'react-router-dom';
import { showApplyFirewallPanel } from '../../(network)/_applyFirewallPanel';
import { EmptyText, Stack } from '../../(network)/_common';
import { ProviderDeploymentTabSection } from '../../../scenes/providerDeployments/tabSection';

export let ProviderDeploymentNetworkPage = () => {
  let instance = useCurrentInstance();
  let { providerDeploymentId } = useParams();
  let deployment = useProviderDeployment(instance.data?.id, providerDeploymentId);
  let enclaves = useEnclaves(instance.data?.id, {
    providerDeploymentId,
    limit: 50,
    order: 'desc'
  });
  let firewallBindings = useFirewallBindings(instance.data?.id, { limit: 100, order: 'desc' });
  let networkLogs = useNetworkLogs(instance.data?.id, { intervalMinutes: 60 });
  let deleteBinding = useDeleteFirewallBinding();

  return renderWithLoader({ deployment, enclaves, firewallBindings, networkLogs })(
    ({ deployment, enclaves, firewallBindings, networkLogs }) => (
      <ProviderDeploymentTabSection>
        <Stack>
          <Box
            title="Enclaves"
            description="Enclaves are secure compute environments that your providers run in. Apply firewalls to them to control network traffic."
          >
            {enclaves.data.items.length > 0 ? (
              <Table
                headers={['Name', 'Environment', 'Last Used', 'Created']}
                data={enclaves.data.items.map(enclave => ({
                  data: [
                    <Text size="2" weight="strong">
                      {enclave.name}
                    </Text>,
                    <Text size="2">{enclave.enclaveEnvironment.name}</Text>,
                    enclave.lastUsedAt ? <RenderDate date={enclave.lastUsedAt} /> : '-',
                    <RenderDate date={enclave.createdAt} />
                  ]
                }))}
              />
            ) : (
              <EmptyText>No enclaves found for this deployment.</EmptyText>
            )}
          </Box>

          <>
            {enclaves.data.items.map(enclave => {
              let enclaveBindings = firewallBindings.data.items.filter(
                binding => binding.target?.id === enclave.id
              );

              return (
                <Box
                  key={enclave.id}
                  title={`${enclave.name} Firewall Rules`}
                  description="Apply firewalls to this enclave."
                  rightActions={
                    <Button
                      size="2"
                      onClick={() =>
                        showApplyFirewallPanel({
                          instanceId: instance.data!.id,
                          targetType: 'enclave',
                          targetId: enclave.id,
                          title: 'Apply Firewall',
                          description: `Choose the firewalls that should apply to ${enclave.name}.`,
                          onComplete: () => firewallBindings.refetch()
                        })
                      }
                    >
                      Apply Firewall
                    </Button>
                  }
                >
                  {enclaveBindings.length > 0 ? (
                    <Table
                      headers={['Firewall', 'Created', '']}
                      data={enclaveBindings.map(binding => ({
                        data: [
                          <Text size="2" weight="strong">
                            {binding.firewall.name}
                          </Text>,
                          <RenderDate date={binding.createdAt} />,
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
                        ]
                      }))}
                    />
                  ) : (
                    <EmptyText>No firewalls are applied to this enclave.</EmptyText>
                  )}
                </Box>
              );
            })}
          </>

          <Box
            title="Network Logs"
            description={`Recent network logs for ${deployment.data.name}.`}
          >
            {(() => {
              let enclaveIds = new Set(enclaves.data.items.map(enclave => enclave.id));
              let records = networkLogs.data.records.filter(record =>
                enclaveIds.has(record.enclaveId)
              );

              return records.length > 0 ? (
                <Table
                  headers={['Host', 'IP', 'Port', 'Count', 'First Seen', 'Last Seen']}
                  data={records.map(record => ({
                    data: [
                      <Text size="2" weight="strong">
                        {record.hostname}
                      </Text>,
                      <Text size="2">{record.ip}</Text>,
                      <Text size="2">{record.port}</Text>,
                      <Text size="2">{record.count}</Text>,
                      <Text size="2">{record.firstSeenAt}</Text>,
                      <Text size="2">{record.lastSeenAt}</Text>
                    ]
                  }))}
                />
              ) : (
                <EmptyText>No network logs found for this deployment's enclaves.</EmptyText>
              );
            })()}
          </Box>
        </Stack>
      </ProviderDeploymentTabSection>
    )
  );
};
