import { ProviderConfigsOverviewTable } from './overviewTable';

export let ProviderConfigsTable = ({
  instanceId,
  providerDeploymentId,
  search
}: {
  instanceId: string;
  providerDeploymentId?: string;
  search?: string;
}) => (
  <ProviderConfigsOverviewTable
    instanceId={instanceId}
    filters={{ search, providerDeploymentId }}
    emptyState="No configs for this deployment."
    listVariant="embedded"
    hideToolbar
  />
);
