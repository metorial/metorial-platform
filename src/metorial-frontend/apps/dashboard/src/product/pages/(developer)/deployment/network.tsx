import { EmptyText, FirewallBindingsTable, Stack } from '../../(network)/_common';
import { ProviderDeploymentTabSection } from '../../../scenes/providerDeployments/tabSection';
import { showApplyFirewallPanel } from '../../(network)/_applyFirewallPanel';
import { useNetworkManagementAccess } from '../../(network)/_gate';
import { col, createDataList } from '@metorial/data-list';
import { renderWithLoader } from '@metorial/data-hooks';
import type { DashboardInstanceIntegrationEnclavesListOutput } from '@metorial/dashboard-sdk';
import {
  useCurrentInstance,
  useIntegrationEnclaves,
  useIntegrationFirewallAssignments,
  useNetworkLogs,
  useProviderDeployment
} from '@metorial/state';
import { Button, RenderDate, Text } from '@metorial/ui';
import { Box, Table } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';

type Enclave = DashboardInstanceIntegrationEnclavesListOutput['items'][number];

let DeploymentEnclavesList = createDataList<{ enclaves: Enclave[] }>(
  'deployment-network-enclaves',
  { customizable: false }
)
  .items(({ props }) => ({ items: props.enclaves }))
  .columns([
    col.name<Enclave>({ description: false }),
    col.text<Enclave>({
      id: 'environment',
      header: 'Environment',
      get: enclave => enclave.enclaveEnvironment.name
    }),
    col.date<Enclave>('lastUsedAt', {
      id: 'lastUsedAt',
      header: 'Last Used',
      isDefault: true
    }),
    col.createdAt<Enclave>()
  ])
  .build();

export let ConfigurationsDeploymentNetworkPage = () => {
  let instance = useCurrentInstance();
  let { providerDeploymentId } = useParams();
  let deployment = useProviderDeployment(instance.data?.id, providerDeploymentId);
  let enclaves = useIntegrationEnclaves(instance.data?.id, {
    providerDeploymentId,
    limit: 50,
    order: 'desc'
  });
  let firewallBindings = useIntegrationFirewallAssignments(instance.data?.id, {
    limit: 100,
    order: 'desc'
  });
  let networkLogs = useNetworkLogs(instance.data?.id, {
    direction: 'egress',
    intervalMinutes: 60
  });
  let { canWrite } = useNetworkManagementAccess();

  return renderWithLoader({ deployment, enclaves, firewallBindings, networkLogs })(
    ({ deployment, enclaves, firewallBindings, networkLogs }) => (
      <ProviderDeploymentTabSection>
        <Stack>
          <Box
            title="Enclaves"
            description="Enclaves are secure compute environments that your providers run in. Apply firewalls to them to control network traffic."
          >
            <DeploymentEnclavesList
              enclaves={enclaves.data.items}
              listVariant="embedded"
              emptyState="No enclaves found for this deployment."
            />
          </Box>

          <>
            {enclaves.data.items.map(enclave => {
              let enclaveBindings = firewallBindings.data.items.filter(
                binding => binding.target?.id === enclave.id
              );

              return (
                <Box
                  key={enclave.id}
                  title="Firewall Rules"
                  description="Apply firewalls to this enclave."
                  rightActions={
                    canWrite ? (
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
                    ) : undefined
                  }
                >
                  <FirewallBindingsTable
                    bindings={enclaveBindings}
                    instanceId={instance.data!.id}
                    canWrite={canWrite}
                    onChange={() => firewallBindings.refetch()}
                    emptyState="No firewalls are applied to this enclave."
                  />
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
                      <RenderDate date={record.firstSeenAt} />,
                      <RenderDate date={record.lastSeenAt} />
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
