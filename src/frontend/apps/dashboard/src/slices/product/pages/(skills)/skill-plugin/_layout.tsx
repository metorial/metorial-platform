import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useSkillPlugin
} from '@metorial/state';
import { LinkTabs } from '@metorial/ui';
import { Outlet, useLocation, useParams } from 'react-router-dom';

export let SkillPluginLayout = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let { skillPluginId } = useParams();
  let plugin = useSkillPlugin(instance.data?.id, skillPluginId);
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

          <Outlet />
        </>
      ))}
    </ContentLayout>
  );
};
