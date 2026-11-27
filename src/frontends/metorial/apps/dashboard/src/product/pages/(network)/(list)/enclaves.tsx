import { DashboardInstanceIntegrationEnclavesListOutput } from '@metorial/dashboard-sdk';
import { col, createDataList } from '@metorial/data-list';
import { Paths } from '@metorial/frontend-config';
import { useIntegrationEnclaves } from '@metorial/state';
import { useInstanceContext } from '../../../lib/dataList';

type Enclave = DashboardInstanceIntegrationEnclavesListOutput['items'][number];

let EnclavesTable = createDataList('network-enclaves')
  .context(useInstanceContext)
  .paginated(({ ctx }) => useIntegrationEnclaves(ctx.instanceId, { order: 'desc' }))
  .columns([
    col.name<Enclave>(),
    col.text<Enclave>({
      id: 'environment',
      header: 'Environment',
      get: enclave => enclave.enclaveEnvironment.name
    }),
    col.refId<Enclave>('network', enclave => enclave.internetGatewayId, {
      header: 'Network',
      isDefault: true
    }),
    col.date<Enclave>('lastUsedAt', {
      id: 'lastUsedAt',
      header: 'Last Used',
      isDefault: true
    }),
    col.createdAt<Enclave>()
  ])
  .link((enclave, _props, ctx) =>
    Paths.instance.providerDeployment(
      ctx.organization,
      ctx.project,
      ctx.instance,
      enclave.providerDeploymentId,
      'network'
    )
  )
  .build();

export let NetworkEnclavesPage = () => <EnclavesTable emptyState="No enclaves found." />;
