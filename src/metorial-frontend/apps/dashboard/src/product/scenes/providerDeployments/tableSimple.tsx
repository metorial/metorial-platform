import { ProviderDeploymentsTable, type ProviderDeploymentsTableProps } from './table';

export let ProviderDeploymentsTableSimple = (props: ProviderDeploymentsTableProps) => (
  <ProviderDeploymentsTable
    emptyState="No deployments for this instance."
    listVariant="embedded"
    hideToolbar
    {...props}
  />
);
