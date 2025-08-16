import { renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ServersImplementationsListQuery } from '@metorial/generated/src/mt_2025_01_01_dashboard';
import { useCurrentInstance, useServerImplementations } from '@metorial/state';
import { RenderDate, Text, theme } from '@metorial/ui';
import { Table } from '@metorial/ui-product';

export let ServerImplementationsTable = (filter: ServersImplementationsListQuery) => {
  let instance = useCurrentInstance();
  let implementations = useServerImplementations(instance.data?.id, filter);

  return renderWithPagination(implementations)(implementations => (
    <>
      <Table
        headers={['Info', 'Server', 'Created']}
        data={implementations.data.items.map(implementation => ({
          data: [
            <Text size="2" weight="strong">
              {implementation.name ?? (
                <span style={{ color: theme.colors.gray600 }}>Untitled</span>
              )}

              {implementation.description && (
                <Text size="2" color="gray600">
                  {implementation.description.slice(0, 60)}
                  {implementation.description.length > 60 ? '...' : ''}
                </Text>
              )}
            </Text>,
            <Text size="2" weight="strong">
              {implementation.server.name}
            </Text>,
            <RenderDate date={implementation.createdAt} />
          ],
          href: Paths.instance.serverImplementation(
            instance.data?.organization,
            instance.data?.project,
            instance.data,
            implementation.id
          )
        }))}
      />

      {implementations.data.items.length == 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No implementations found.
        </Text>
      )}
    </>
  ));
};
