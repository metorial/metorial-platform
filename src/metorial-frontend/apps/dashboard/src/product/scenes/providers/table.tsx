import { renderWithPagination } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useProviders } from '@metorial/state';
import { RenderDate, Text, theme } from '@metorial/ui';
import { Table } from '@metorial/ui-product';

export let ProvidersTable = ({
  instanceId,
  search
}: {
  instanceId: string;
  search?: string;
}) => {
  let instance = useCurrentInstance();
  let providers = useProviders(instanceId);

  return renderWithPagination(providers)(providers => (
    <>
      <Table
        headers={['Name', 'Slug', 'Created']}
        data={providers.data.items
          .filter(
            p =>
              !search ||
              p.name?.toLowerCase().includes(search.toLowerCase()) ||
              p.slug?.toLowerCase().includes(search.toLowerCase())
          )
          .map(provider => ({
            data: [
              <Text size="2" weight="strong">
                {provider.name ?? <span style={{ color: theme.colors.gray600 }}>Unnamed</span>}
                {provider.description && (
                  <Text size="2" color="gray600">
                    {provider.description.slice(0, 60)}
                    {provider.description.length > 60 ? '...' : ''}
                  </Text>
                )}
              </Text>,
              <Text size="2">{provider.slug}</Text>,
              <RenderDate date={provider.createdAt} />
            ],
            href: Paths.instance.provider(
              instance.data?.organization,
              instance.data?.project,
              instance.data,
              provider.slug
            )
          }))}
      />

      {providers.data.items.length == 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No providers found.
        </Text>
      )}
    </>
  ));
};
