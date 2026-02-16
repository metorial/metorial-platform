import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useMagicMcpGroup
} from '@metorial/state';
import { LinkTabs } from '@metorial/ui';
import { Outlet, useLocation, useParams } from 'react-router-dom';

export let MagicMcpGroupLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();

  let { magicMcpGroupId } = useParams();
  let group = useMagicMcpGroup(instance.data?.instanceId, magicMcpGroupId);

  let pathname = useLocation().pathname;

  let serverPathParams = [
    organization.data,
    project.data,
    instance.data,
    group.data?.id ?? magicMcpGroupId
  ] as const;

  return (
    <ContentLayout>
      <PageHeader
        title={group.data?.name ?? '...'}
        description={group.data?.description ?? undefined}
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
            label: group.data?.name,
            href: Paths.instance.magicMcp.server(
              organization.data,
              project.data,
              instance.data,
              group.data?.id ?? magicMcpGroupId
            )
          }
        ]}
      />

      {renderWithLoader({ group })(({ group }) => (
        <>
          <LinkTabs
            current={pathname}
            links={[
              {
                label: 'Overview',
                to: Paths.instance.magicMcp.group(...serverPathParams)
              },
              {
                label: 'Settings',
                to: Paths.instance.magicMcp.group(...serverPathParams, 'settings')
              }
            ]}
          />

          <Outlet />
        </>
      ))}
    </ContentLayout>
  );
};
