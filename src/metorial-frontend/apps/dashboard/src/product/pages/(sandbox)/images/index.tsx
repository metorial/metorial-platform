import { col, createDataList, defineAction, f } from '@metorial/data-list';
import { PaginationSearchParamsProvider } from '@metorial/data-hooks';
import { EmptyState } from '@metorial/empty-state';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  type DashboardInstanceSandboxImagesListOutput,
  sandboxMachinesLoader,
  useDeleteSandboxImageFromList,
  useSandboxImages
} from '@metorial/state';
import { Badge, Button, Flex, Text, confirm } from '@metorial/ui';
import { useNavigate } from 'react-router-dom';
import { useInstanceContext } from '../../../lib/dataList';
import { showSandboxCreateMachinePanel } from '../../../scenes/sandbox/createMachinePanel';
import { showSandboxImageBuildPanel } from '../../../scenes/sandbox/imageBuildPanel';
import { ImageStack, imageVersionLabel } from '../../../scenes/sandbox/images/common';
import { SandboxImageLogo } from '../../../scenes/sandbox/shared/imageLogo';
import { SandboxImageStatusBadge } from '../../../scenes/sandbox/shared/statusBadges';
import { SandboxManagedPage, useSandboxAccess } from '../_gate';

type Image = DashboardInstanceSandboxImagesListOutput['items'][number];

let ownerOptions = [
  { id: 'own', label: 'Your Images' },
  { id: 'global', label: 'Metorial' }
] as const;

let imageTitle = (image: Image) => image.name || image.identifier || 'Untitled image';

let imageVersion = (image: Image) =>
  image.owner === 'own' && image.latestVersionId
    ? imageVersionLabel({
        id: image.latestVersionId,
        versionNumber: image.latestVersionNumber
      })
    : undefined;

let countMachines = async (instanceId: string, imageId: string) => {
  let count = 0;
  let after: string | undefined;

  while (true) {
    let page = await sandboxMachinesLoader.fetchAndReturn(
      { instanceId, imageId, limit: 100, after },
      { force: true }
    );

    count += page.items.length;
    if (!page.pagination.hasMoreAfter || !page.items.length) break;
    after = page.items.at(-1)!.id;
  }

  return count;
};

let ImagesTable = createDataList('sandbox-images')
  .context(useInstanceContext)
  .filters(() => ({
    owner: f.select('owner', 'Owner', ownerOptions)
  }))
  .search('Search images…')
  .paginated(({ ctx, filters, search, limit }) =>
    useSandboxImages(
      ctx.instanceId,
      {
        owner: filters.owner,
        search,
        status: ['pending', 'active'],
        limit: limit ?? 24,
        order: 'desc'
      },
      { pollInterval: 10_000 }
    )
  )
  .columns([
    col.custom<Image>({
      id: 'name',
      header: 'Name',
      render: image => (
        <Flex gap={8} align="center">
          <SandboxImageLogo image={image} />
          <Text size="2" weight="strong">
            {imageTitle(image)}
          </Text>
        </Flex>
      )
    }),
    col.text<Image>({
      id: 'owner',
      header: 'Owner',
      get: image => (image.owner === 'own' ? 'Your Images' : 'Managed by Metorial')
    }),
    col.text<Image>({ id: 'version', header: 'Latest Version', get: imageVersion }),
    col.custom<Image>({
      id: 'status',
      header: 'Status',
      isDefault: false,
      render: image => <SandboxImageStatusBadge status={image.status} />
    }),
    col.createdAt<Image>(),
    col.id<Image>()
  ])
  .link((image, _props, ctx) =>
    Paths.instance.sandboxImage(ctx.organization, ctx.project, ctx.instance, image.id)
  )
  .item(image => ({
    title: imageTitle(image),
    icon: <SandboxImageLogo image={image} size={40} />,
    footer: (
      <>
        {imageVersion(image) && (
          <Badge color="gray" size="2">
            {imageVersion(image)}
          </Badge>
        )}
        {image.owner === 'global' && (
          <Badge color="gray" size="2">
            Managed by Metorial
          </Badge>
        )}
      </>
    ),
    height: 200
  }))
  .layouts(['grid', 'table'], { default: 'grid' })
  .itemActions([
    defineAction<Image>({
      id: 'create-machine',
      label: 'Create Machine',
      hidden: image => !image.latestVersionId,
      useRun: () => image => showSandboxCreateMachinePanel({ imageId: image.id })
    }),
    defineAction<Image>({
      id: 'rename',
      label: 'Rename',
      hidden: image => image.owner !== 'own',
      useRun: ({ ctx }) => {
        let navigate = useNavigate();

        return image =>
          navigate(
            Paths.instance.sandboxImage(
              ctx.organization,
              ctx.project,
              ctx.instance,
              image.id,
              'settings'
            )
          );
      }
    }),
    defineAction<Image>({
      id: 'delete',
      label: 'Delete Image',
      destructive: true,
      hidden: image => image.owner !== 'own',
      useRun: ({ ctx }) => {
        let remove = useDeleteSandboxImageFromList();

        return async image => {
          if (!ctx.instanceId) return;

          let count = await countMachines(ctx.instanceId, image.id);

          confirm({
            title: 'Delete Image',
            description: `Running builds are cancelled. ${count} machines use this image.`,
            confirmText: 'Delete Image',
            onConfirm: () => {
              void remove.mutate({ instanceId: ctx.instanceId!, imageId: image.id });
            }
          });
        };
      }
    })
  ])
  .build();

let ImagesContent = () => (
  <ImageStack>
    <ImagesTable
      emptyState={{
        initial: () => (
          <EmptyState
            title="No Images Yet"
            description="Build an image from a Dockerfile."
            action={{ label: 'Create Image', onClick: () => showSandboxImageBuildPanel({}) }}
          />
        ),
        filtered: 'No images matched your search or filters.'
      }}
    />
  </ImageStack>
);

export let SandboxImagesPage = () => {
  let access = useSandboxAccess();

  return (
    <ContentLayout>
      <PageHeader
        title="Machine Images"
        description="The operating system and tools a machine boots with."
        actions={
          <Button
            size="2"
            disabled={!access.canWrite}
            onClick={() => showSandboxImageBuildPanel({})}
          >
            Create Image
          </Button>
        }
      />
      <SandboxManagedPage>
        <PaginationSearchParamsProvider enabled={false}>
          <ImagesContent />
        </PaginationSearchParamsProvider>
      </SandboxManagedPage>
    </ContentLayout>
  );
};
