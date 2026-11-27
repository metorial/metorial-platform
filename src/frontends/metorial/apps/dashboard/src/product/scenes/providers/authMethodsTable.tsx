import { col, createDataList, defineAction } from '@metorial/data-list';
import { useProviderAuthMethods } from '@metorial/state';
import { Badge } from '@metorial/ui';
import { RiEyeLine } from '@remixicon/react';
import {
  getProviderAuthMethodTypeColor,
  getProviderAuthMethodTypeLabel,
  showProviderAuthMethodDetailsModal,
  type ProviderAuthMethod
} from './authMethodDetails';

let viewDetails = defineAction<ProviderAuthMethod>({
  id: 'view-details',
  label: 'View Details',
  icon: <RiEyeLine />,
  useRun: () => async row => showProviderAuthMethodDetailsModal(row)
});

let ProviderAuthMethodsList = createDataList<{
  instanceId: string;
  providerVersionId?: string;
}>('provider-auth-methods')
  .paginated(({ props }) =>
    useProviderAuthMethods(
      props.instanceId,
      props.providerVersionId ? { providerVersionId: props.providerVersionId } : null
    )
  )
  .columns([
    col.name<ProviderAuthMethod>({ description: false }),
    col.custom<ProviderAuthMethod>({
      id: 'type',
      header: 'Type',
      render: row => (
        <Badge color={getProviderAuthMethodTypeColor(row.type)} size="2">
          {getProviderAuthMethodTypeLabel(row.type)}
        </Badge>
      )
    }),
    col.id<ProviderAuthMethod>({ isDefault: true }),
    col.text<ProviderAuthMethod>({
      id: 'description',
      header: 'Description',
      isDefault: false,
      get: row =>
        row.description &&
        row.description.slice(0, 110) + (row.description.length > 110 ? '...' : '')
    })
  ])
  .clickable(row => showProviderAuthMethodDetailsModal(row))
  .itemActions([viewDetails])
  .build();

export let ProviderAuthMethodsTable = (p: {
  instanceId: string;
  providerVersionId?: string;
}) => (
  <ProviderAuthMethodsList
    {...p}
    listVariant="embedded"
    emptyState="No authentication methods found for this provider."
  />
);
