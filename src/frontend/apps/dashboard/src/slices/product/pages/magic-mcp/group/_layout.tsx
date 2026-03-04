import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { LinkTabs } from '@metorial/ui';
import { Outlet, useLocation, useParams } from 'react-router-dom';

export let MagicMcpGroupLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();
  let { magicMcpGroupId } = useParams();
  let pathname = useLocation().pathname;

  let groupPathParams = [
    organization.data,
    project.data,
    instance.data,
    magicMcpGroupId
  ] as const;

  return (
    <ContentLayout>
      <PageHeader
        title={magicMcpGroupId ?? 'Magic MCP Group'}
        pagination={[
          {
            label: 'Magic MCP Groups',
            href: Paths.instance.magicMcp.groups(
              organization.data,
              project.data,
              instance.data
            )
          },
          {
            label: magicMcpGroupId,
            href: Paths.instance.magicMcp.group(...groupPathParams)
          }
        ]}
      />

      <LinkTabs
        current={pathname}
        links={[
          {
            label: 'Overview',
            to: Paths.instance.magicMcp.group(...groupPathParams)
          },
          {
            label: 'Settings',
            to: Paths.instance.magicMcp.group(...groupPathParams, 'settings')
          }
        ]}
      />

      <Outlet />
    </ContentLayout>
  );
};
