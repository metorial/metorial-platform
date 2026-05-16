import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useSkillPlugin
} from '@metorial/state';
import { Button, Callout, LinkTabs, Spacer } from '@metorial/ui';
import { Outlet, useLocation, useParams } from 'react-router-dom';

export let SkillPluginLayout = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let { skillPluginId } = useParams();
  let plugin = useSkillPlugin(instance.data?.id, skillPluginId);
  let syncPlugin = plugin.syncMutator();
  let pathname = useLocation().pathname;

  let pluginPathParams = [
    organization.data,
    project.data,
    instance.data,
    plugin.data?.id ?? skillPluginId
  ] as const;

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
