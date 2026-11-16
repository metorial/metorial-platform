import { col, createDataList } from '@metorial/data-list';
import { Paths } from '@metorial/frontend-config';
import { useProviders } from '@metorial/state';
import { useInstanceContext } from '../../lib/dataList';

let truncate = (value: string, length: number) =>
  value.slice(0, length) + (value.length > length ? '...' : '');

let ProvidersList = createDataList<{ instanceId: string; search?: string }>('providers-table')
  .context(useInstanceContext)
  .search('Search providers…')
  .paginated(({ props, search }) =>
    useProviders(props.instanceId, { search: search ?? props.search })
  )
  .columns([
    col.name({
      description: row => (row.description ? truncate(row.description, 60) : null)
    }),
    col.text({ id: 'slug', header: 'Slug', get: row => row.slug }),
    col.createdAt()
  ])
  .link((row, _props, ctx) =>
    Paths.instance.provider(ctx.organization, ctx.project, ctx.instance, row.slug)
  )
  .build();

export let ProvidersTable = (p: { instanceId: string; search?: string }) => (
  <ProvidersList {...p} listVariant="embedded" />
);
