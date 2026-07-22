import { InitialLoadBoundary, renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCreateSkillExport,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useSkillMarketplace
} from '@metorial/state';
import { Button, Flex, LinkTabs, toast } from '@metorial/ui';
import { Outlet, useLocation, useParams } from 'react-router-dom';
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
  let pathname = useLocation().pathname;

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
    <ContentLayout>
      <PageHeader
        title={marketplace.data?.name ?? '...'}
        description={marketplace.data?.description ?? undefined}
        pagination={[
          {
            label: 'Skill Marketplaces',
            href: Paths.instance.skillMarketplaces(
              organization.data,
              project.data,
              instance.data
            )
          },
          {
            label: marketplace.data?.name ?? '...',
            href: Paths.instance.skillMarketplace(...marketplacePathParams)
          }
        ]}
        actions={
          <Flex gap="8px">
            <Button
              size="2"
              disabled={!instance.data || !marketplace.data}
              loading={createSkillExport.isLoading}
              success={createSkillExport.isSuccess}
              onClick={exportMarketplace}
            >
              Export Marketplace
            </Button>
          </Flex>
        }
      />

      <InitialLoadBoundary>
        {renderWithLoader({ marketplace })(() => (
          <>
            <LinkTabs
              current={pathname}
              links={[
                {
                  label: 'Overview',
                  to: Paths.instance.skillMarketplace(...marketplacePathParams)
                },
                {
                  label: 'Settings',
                  to: Paths.instance.skillMarketplace(...marketplacePathParams, 'settings')
                }
              ]}
            />

            <Outlet />
          </>
        ))}
      </InitialLoadBoundary>
    </ContentLayout>
  );
};
