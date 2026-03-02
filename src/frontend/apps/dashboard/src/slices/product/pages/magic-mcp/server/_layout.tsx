import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { LinkTabs } from '@metorial/ui';
import { Outlet, useLocation, useParams } from 'react-router-dom';

export let MagicMcpServerLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();
  let { magicMcpServerId } = useParams();
  let pathname = useLocation().pathname;

  let serverPathParams = [
    organization.data,
    project.data,
    instance.data,
    magicMcpServerId
  ] as const;

  return (
    <ContentLayout>
      <PageHeader
        title={magicMcpServerId ?? 'Magic MCP Server'}
        pagination={[
          {
            label: 'Magic MCP Servers',
            href: Paths.instance.magicMcp.servers(
              organization.data,
              project.data,
              instance.data
            )
          },
          {
            label: magicMcpServerId,
            href: Paths.instance.magicMcp.server(...serverPathParams)
          }
        ]}
      />

      <LinkTabs
        current={pathname}
        links={[
          {
            label: 'Overview',
            to: Paths.instance.magicMcp.server(...serverPathParams)
          },
          {
            label: 'Sessions',
            to: Paths.instance.magicMcp.server(...serverPathParams, 'sessions')
          },
          {
            label: 'Runs',
            to: Paths.instance.magicMcp.server(...serverPathParams, 'runs')
          },
          {
            label: 'Errors',
            to: Paths.instance.magicMcp.server(...serverPathParams, 'errors')
          },
          {
            label: 'OAuth',
            to: Paths.instance.magicMcp.server(...serverPathParams, 'oauth')
          },
          {
            label: 'Settings',
            to: Paths.instance.magicMcp.server(...serverPathParams, 'config')
          }
        ]}
      />

      <Outlet />
    </ContentLayout>
  );
};
