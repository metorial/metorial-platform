import { InitialLoadBoundary, renderWithLoader } from '@metorial/data-hooks';
import { DetailsLayout } from '@metorial/details-layout';
import { Paths } from '@metorial/frontend-config';
import {
  useCreateSkillExport,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useSkillMarketplace
} from '@metorial/state';
import { Badge, RenderDate, toast } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { RiStore2Line } from '@remixicon/react';
import { Outlet, useParams } from 'react-router-dom';
import { useInterval } from 'react-use';

let downloadExport = (url: string, fileName: string) => {
  let link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
};

export let SkillMarketplaceLayout = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let { skillMarketplaceId } = useParams();
  let marketplace = useSkillMarketplace(instance.data?.id, skillMarketplaceId);
  let createSkillExport = useCreateSkillExport();

  let marketplacePathParams = [
    organization.data,
    project.data,
    instance.data,
    marketplace.data?.id ?? skillMarketplaceId
  ] as const;

  let exportMarketplace = () => {
    if (!instance.data || !marketplace.data) return;

    toast.promise(
      async () => {
        let [skillExport, error] = await createSkillExport.mutate({
          instanceId: instance.data!.id,
          target: 'marketplace',
          skillMarketplaceId: marketplace.data!.id
        });

        if (error) throw error;
        if (!skillExport?.fileLink)
          throw new Error('Export completed without a download link');

        downloadExport(skillExport.fileLink!.url, `${marketplace.data!.slug}.zip`);
      },
      {
        loading: 'Exporting marketplace...',
        success: 'Marketplace export downloaded',
        error: 'Failed to export marketplace'
      }
    );
  };

  useInterval(() => {
    marketplace.refetch();
  }, 10_000);

  // useInterval(
  //   () => {
  //     if (marketplace.data?.syncStatus !== 'synced' && !syncMarketplace.isLoading) {
  //       syncMarketplace.mutate({});
  //     }
  //   },
  //   marketplace.data?.syncStatus === 'pending' ? 10_000 : 60_000
  // );

  return (
    <DetailsLayout
      entity={marketplace.data}
      icon={<RiStore2Line />}
      breadcrumbs={[
        {
          label: 'Skill Marketplaces',
          to: Paths.instance.skillMarketplaces(organization.data, project.data, instance.data)
        },
        {
          label: marketplace.data?.name,
          to: Paths.instance.skillMarketplace(...marketplacePathParams)
        }
      ]}
      tabs={[
        {
          label: 'Overview',
          to: Paths.instance.skillMarketplace(...marketplacePathParams)
        },
        {
          label: 'Settings',
          to: Paths.instance.skillMarketplace(...marketplacePathParams, 'settings')
        }
      ]}
      actions={[
        {
          label: 'Export Marketplace',
          disabled: !instance.data || !marketplace.data,
          loading: createSkillExport.isLoading,
          success: createSkillExport.isSuccess,
          onClick: exportMarketplace
        }
      ]}
      attributes={
        marketplace.data
          ? [
              { label: 'ID', value: <ID id={marketplace.data.id} /> },
              {
                label: 'Status',
                value: <Badge color="gray">{marketplace.data.status}</Badge>
              },
              { label: 'Slug', value: marketplace.data.slug },
              { label: 'Created', value: <RenderDate date={marketplace.data.createdAt} /> }
            ]
          : []
      }
    >
      <InitialLoadBoundary>
        {renderWithLoader({ marketplace })(() => (
          <Outlet />
        ))}
      </InitialLoadBoundary>
    </DetailsLayout>
  );
};
