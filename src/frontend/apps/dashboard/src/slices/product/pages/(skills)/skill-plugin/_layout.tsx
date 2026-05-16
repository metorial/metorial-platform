import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCreateSkillExport,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useSkillPlugin
} from '@metorial/state';
import { Button, Callout, Flex, LinkTabs, Spacer, toast } from '@metorial/ui';
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

export let SkillPluginLayout = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let { skillPluginId } = useParams();
  let plugin = useSkillPlugin(instance.data?.id, skillPluginId);
  let syncPlugin = plugin.syncMutator();
  let createSkillExport = useCreateSkillExport();
  let pathname = useLocation().pathname;

  let pluginPathParams = [
    organization.data,
    project.data,
    instance.data,
    plugin.data?.id ?? skillPluginId
  ] as const;

  let exportPlugin = () => {
    if (!instance.data || !plugin.data) return;

    toast.promise(
      async () => {
        let [skillExport, error] = await createSkillExport.mutate({
          instanceId: instance.data!.id,
          target: 'plugin',
          skillPluginId: plugin.data!.id
        });

        if (error) throw error;
        if (!skillExport?.fileLink)
          throw new Error('Export completed without a download link');

        downloadExport(skillExport.fileLink!.url, `${plugin.data!.slug}.zip`);
      },
      {
        loading: 'Exporting plugin...',
        success: 'Plugin export downloaded',
        error: 'Failed to export plugin'
      }
    );
  };

  useInterval(
    () => {
      if (plugin.data?.syncStatus !== 'synced' && !syncPlugin.isLoading) {
        syncPlugin.mutate({});
      }
    },
    plugin.data?.syncStatus === 'pending' ? 10_000 : 60_000
  );

  return (
    <ContentLayout>
      <PageHeader
        title={plugin.data?.name ?? '...'}
        description={plugin.data?.description ?? undefined}
        pagination={[
          {
            label: 'Skill Plugins',
            href: Paths.instance.skillPlugins(organization.data, project.data, instance.data)
          },
          {
            label: plugin.data?.name ?? '...',
            href: Paths.instance.skillPlugin(...pluginPathParams)
          }
        ]}
        actions={
          <Flex gap="8px">
            <Button
              size="2"
              disabled={!instance.data || !plugin.data}
              loading={createSkillExport.isLoading}
              success={createSkillExport.isSuccess}
              onClick={exportPlugin}
            >
              Export Plugin
            </Button>
          </Flex>
        }
      />

      {renderWithLoader({ plugin })(() => (
        <>
          <LinkTabs
            current={pathname}
            links={[
              {
                label: 'Overview',
                to: Paths.instance.skillPlugin(...pluginPathParams)
              },
              {
                label: 'Preview',
                to: Paths.instance.skillPlugin(...pluginPathParams, 'editor')
              },
              {
                label: 'Settings',
                to: Paths.instance.skillPlugin(...pluginPathParams, 'settings')
              }
            ]}
          />

          {plugin.data?.syncStatus !== 'synced' && (
            <>
              <Callout color="blue">
                <span>
                  <strong>Upcoming changes:</strong> Skills or configurations linked to this
                  plugin have changed. Metorial is processing these changes and updating the
                  plugin.
                </span>
                {plugin.data?.syncStatus === 'pending' && (
                  <Button
                    size="2"
                    loading={syncPlugin.isLoading}
                    onClick={() => syncPlugin.mutate({})}
                    style={{ marginLeft: 16 }}
                  >
                    Sync Now
                  </Button>
                )}
              </Callout>

              <Spacer height={20} />
            </>
          )}

          <Outlet />
        </>
      ))}
    </ContentLayout>
  );
};
