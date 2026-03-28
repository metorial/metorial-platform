import { renderWithPagination } from '@metorial/data-hooks';
import { useProviderAuthMethods } from '@metorial/state';
import { Text, theme } from '@metorial/ui';
import { Table } from '@metorial/ui-product';

export let ProviderAuthMethodsTable = ({
  instanceId,
  providerVersionId
}: {
  instanceId: string;
  providerVersionId?: string;
}) => {
  let authMethods = useProviderAuthMethods(
    instanceId,
    providerVersionId ? { providerVersionId } : null
  );

  return renderWithPagination(authMethods)(authMethods => (
    <>
      <Table
        headers={['Name', 'Type', 'Description']}
        data={authMethods.data.items.map(method => ({
          data: [
            <Text size="2" weight="strong">
              {method.name ?? <span style={{ color: theme.colors.gray600 }}>Unnamed</span>}
            </Text>,
            <Text size="2">{method.type}</Text>,
            <Text size="2" color="gray600">
              {method.description?.slice(0, 80)}
              {(method.description?.length ?? 0) > 80 ? '...' : ''}
            </Text>
          ]
        }))}
      />

      {authMethods.data.items.length == 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No auth methods found.
        </Text>
      )}
    </>
  ));
};
