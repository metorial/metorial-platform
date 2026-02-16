import { renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { DashboardInstanceServersImplementationsListQuery } from '@metorial/dashboard-sdk/src/gen/src/mt_2026_02_01_dashboard';
import { useCurrentInstance, useServerImplementations } from '@metorial/state';
import { Input, RenderDate, Spacer, Text, theme } from '@metorial/ui';
import { Table } from '@metorial/ui-product';
import { useState } from 'react';
import { useDebounced } from '../../../../hooks/useDebounced';

export let ServerImplementationsTable = (filter: DashboardInstanceServersImplementationsListQuery) => {
  let [search, setSearch] = useState('');
  let searchDebounced = useDebounced(search, 500);

  let instance = useCurrentInstance();
  let implementations = useServerImplementations(instance.data?.instanceId, {
    ...filter,
    search: searchDebounced.length ? searchDebounced : undefined
  });

  return (
    <>
      <Input
        label="Search"
        hideLabel
        placeholder="Search for providers"
        value={search}
        onInput={v => setSearch(v)}
      />

      <Spacer size={15} />

      {renderWithPagination(implementations)(implementations => (
        <>
          <Table
            headers={['Info', 'Provider', 'Created']}
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
                  {implementation.server?.name ?? implementation.name ?? 'Unknown'}
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
      ))}
    </>
  );
};
