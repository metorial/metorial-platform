import { ProviderAuthConfigsOverviewTable } from './overviewTable';

export let ProviderAuthConfigsTable = ({
  instanceId,
  search,
  providerDeploymentId
}: {
  instanceId: string;
  search?: string;
  providerDeploymentId?: string;
}) => (
  <ProviderAuthConfigsOverviewTable
    instanceId={instanceId}
    filters={{ search, providerDeploymentId }}
    emptyState="No auth configs for this deployment."
    listVariant="embedded"
    hideToolbar
  />
);
