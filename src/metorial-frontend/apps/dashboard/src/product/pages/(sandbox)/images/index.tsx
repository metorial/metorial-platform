import { PaginationSearchParamsProvider, renderWithPagination } from '@metorial/data-hooks';
import { EmptyState } from '@metorial/empty-state';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  type DashboardInstanceSandboxImagesListOutput,
  useDeleteSandboxImageFromList,
  useSandboxImages
} from '@metorial/state';
import {
  type TableFilter,
  type TableFilterState,
  TableFilters,
  getEnumListFilterValue,
  getFilterPayload,
  useFilterQuery
} from '@metorial/table';
import { Badge, Button, Input, Text } from '@metorial/ui';
import { ItemGrid } from '@metorial/ui-product';
import { useDebounced } from '@metorial/use-debounced';
import { memo, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { showSandboxCreateMachinePanel } from '../../../scenes/sandbox/createMachinePanel';
import { showSandboxImageBuildPanel } from '../../../scenes/sandbox/imageBuildPanel';
import {
  ImageStack,
  imageVersionLabel,
  useConfirmSandboxImageDeletion,
  useSandboxImagePaths
} from '../../../scenes/sandbox/images/common';
import { SandboxImageLogo } from '../../../scenes/sandbox/shared/imageLogo';
import { SandboxManagedPage } from '../_gate';

type Image = DashboardInstanceSandboxImagesListOutput['items'][number];
let ownerValues = ['own', 'global'] as const;

let filters: TableFilter<any>[] = [
  {
    id: 'owner',
    fields: ['owner'],
    label: 'Owner',
    description: 'Filter by owner',
    type: 'select',
    options: [
      { id: 'own', label: 'Your Images' },
      { id: 'global', label: 'Metorial' }
    ]
  }
];

let ImageCard = memo(({ image }: { image: Image }) => {
  let paths = useSandboxImagePaths();
  let navigate = useNavigate();
  let remove = useDeleteSandboxImageFromList();
  let deletion = useConfirmSandboxImageDeletion({
    instanceId: paths.instanceId,
    imageId: image.id,
    onDelete: () => remove.mutate({ instanceId: paths.instanceId!, imageId: image.id })
  });
  return (
    <div>
      <ItemGrid.Item
        variant="v2"
        loading={remove.isLoading || deletion.isLoading}
        icon={<SandboxImageLogo image={image} size={40} />}
        title={image.name || image.identifier || 'Untitled image'}
        entity={image}
        href={paths.image(image.id)}
        bottom={
          <>
            {image.owner === 'own' && image.latestVersionId && (
              <Badge color="gray" size="1">
                {imageVersionLabel({
                  id: image.latestVersionId,
                  versionNumber: image.latestVersionNumber
                })}
              </Badge>
            )}
            {image.owner === 'global' && (
              <Badge color="gray" size="1">
                Managed by Metorial
              </Badge>
            )}
          </>
        }
        menu={[
          ...(image.latestVersionId
            ? [
                {
                  label: 'Create Machine',
                  onClick: () => showSandboxCreateMachinePanel({ imageId: image.id })
                }
              ]
            : []),
          ...(image.owner === 'own'
            ? [
                {
                  label: 'Rename',
                  onClick: () => navigate(paths.image(image.id, 'settings'))
                },
                {
                  label: 'Delete Image',
                  onClick: () => {
                    void deletion.mutate();
                  }
                }
              ]
            : [])
        ]}
      />
      <deletion.RenderError />
      <remove.RenderError />
    </div>
  );
});

let ImagesContent = () => {
  let [search, setSearch] = useState('');
  let [filterState, setFilterState] = useState<TableFilterState[]>([]);
  let debounced = useDebounced(search, 500);
  useFilterQuery({
    filters,
    filterState: [filterState, setFilterState],
    searchState: [search, setSearch],
    debouncedSearch: debounced
  });
  let owner = getEnumListFilterValue(getFilterPayload(filterState).owner, ownerValues);
  let filtered = !!search.trim() || !!debounced.trim() || !!owner?.length;
  let paths = useSandboxImagePaths();
  let images = useSandboxImages(
    paths.instanceId,
    {
      owner,
      search: debounced.trim() || undefined,
      status: ['pending', 'active'],
      limit: 24,
      order: 'desc'
    },
    { pollInterval: 10_000 }
  );

  let renderImages = useCallback(
    (images: { data: DashboardInstanceSandboxImagesListOutput }) => {
      if (!images.data.items.length && !filtered) {
        return (
          <EmptyState
            title="No Images Yet"
            description="Build an image from a Dockerfile."
            action={{ label: 'Create Image', onClick: () => showSandboxImageBuildPanel({}) }}
          />
        );
      }

      return images.data.items.length ? (
        <ItemGrid.Root columns={3} responsive>
          {images.data.items.map(image => (
            <ImageCard key={image.id} image={image} />
          ))}
        </ItemGrid.Root>
      ) : (
        <Text size="2" color="gray600">
          No images matched your search or filters.
        </Text>
      );
    },
    [filtered]
  );
  let content = renderWithPagination(images)(renderImages);

  return (
    <ImageStack>
      {(filtered || !!images.data?.items.length) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <Input
              size="2"
              label="Search Images"
              hideLabel
              placeholder="Search images..."
              value={search}
              onInput={setSearch}
            />
          </div>
          <TableFilters
            filters={filters}
            filterState={[filterState, setFilterState]}
            fullWidth={false}
            defaultFilterId="owner"
          />
        </div>
      )}
      {content}
    </ImageStack>
  );
};

export let SandboxImagesPage = () => (
  <SandboxManagedPage withLayout>
    <ContentLayout>
      <PageHeader
        title="Machine Images"
        description="The operating system and tools a machine boots with."
        actions={
          <Button size="2" onClick={() => showSandboxImageBuildPanel({})}>
            Create Image
          </Button>
        }
      />
      <PaginationSearchParamsProvider enabled={false}>
        <ImagesContent />
      </PaginationSearchParamsProvider>
    </ContentLayout>
  </SandboxManagedPage>
);
