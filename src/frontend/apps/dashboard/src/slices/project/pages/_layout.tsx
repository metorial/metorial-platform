import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentPanelLayout, ContentPanelLayoutInner, SidebarPane } from '@metorial/layout';
import { useCurrentProject } from '@metorial/state';
import { atom, useAtom } from '@metorial/ui';
import { RiHome3Line, RiSettings2Line } from '@remixicon/react';
import { useEffect, useLayoutEffect } from 'react';
import { Outlet } from 'react-router-dom';

export let layoutAtom = atom<{
  title: React.ReactNode;
  breadcrumbs: { label: string; to: string }[];
}>({
  title: 'Metorial Organization',
  breadcrumbs: []
});

export let useSetLayout = (options: {
  title: React.ReactNode;
  breadcrumbs: { label: string; to: string }[];
}) => {
  useLayoutEffect(() => layoutAtom.set(options), []);
  useEffect(() => layoutAtom.set(options), []);
};

export let ProjectSettingsPageLayout = () => {
  let layout = useAtom(layoutAtom);

  let project = useCurrentProject();

  let params = [project.data?.organization, project.data] as const;

  return (
    <SidebarPane
      id="project"
      groups={[
        {
          label: project.data?.name || 'Project',
          items: [
            {
              icon: <RiHome3Line />,
              label: 'Home',
              to: Paths.project.settings(...params)
            },
            {
              icon: <RiSettings2Line />,
              label: 'Instances',
              to: Paths.project.settings(...params, 'instances')
            }
          ]
        }
      ]}
    >
      <ContentPanelLayout
        title="Hello"
        breadcrumbs={[
          {
            label: project.data?.name || 'Project',
            to: Paths.project.settings(...params)
          },
          ...layout.breadcrumbs.map(breadcrumb => ({
            label: breadcrumb.label,
            to: Paths.project.settings(...params, breadcrumb.to)
          }))
        ]}
      >
        <ContentPanelLayoutInner>
          {renderWithLoader({
            project
          })(({}) => (
            <Outlet />
          ))}
        </ContentPanelLayoutInner>
      </ContentPanelLayout>
    </SidebarPane>
  );
};
