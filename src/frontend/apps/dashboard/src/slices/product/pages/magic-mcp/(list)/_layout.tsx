import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { Button, LinkTabs } from '@metorial/ui';
import { Outlet, useLocation } from 'react-router-dom';
import { createMagicMcpTokenModal } from '../../../scenes/magicMcp/tokensTable';
import { showMagicMcpServerFormModal } from '../../../scenes/serverDeployments/modal';

export let MagicMcpListLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();

  let pathname = useLocation().pathname;
  let tab = pathname.split('/').pop();

  return (
    <ContentLayout>
      <PageHeader
        title="Magic MCP"
        description="MCP servers on easy more. Just create your server and connect to it."
        actions={
          {
            servers: (
              <Button
                onClick={() =>
                  showMagicMcpServerFormModal({
                    type: 'create'
                  })
                }
                size="2"
              >
                Create Magic MCP Server
              </Button>
            ),
            tokens: (
              <Button size="2" onClick={() => createMagicMcpTokenModal()}>
                Create Magic MCP Token
              </Button>
            )
          }[tab!]
        }
      />

      <LinkTabs
        current={pathname}
        links={[
          {
            label: 'Servers',
            to: Paths.instance.magicMcp.servers(organization.data, project.data, instance.data)
          },
          {
            label: 'Sessions',
            to: Paths.instance.magicMcp.sessions(
              organization.data,
              project.data,
              instance.data
            )
          },
          {
            label: 'Tokens',
            to: Paths.instance.magicMcp.tokens(organization.data, project.data, instance.data)
          }
        ]}
      />

      <Outlet />
    </ContentLayout>
  );
};
