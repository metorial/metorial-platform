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
  let group = useMagicMcpGroup(instance.data?.id, magicMcpGroupId);
  let pathname = useLocation().pathname;

  let groupPathParams = [
    organization.data,
    project.data,
    instance.data,
    group.data?.id ?? magicMcpGroupId
  ] as const;

  return (
    <ContentLayout>
      {renderWithLoader({ group })(({ group }) => {
        let groupLabel = group.data.name ?? group.data.id;

        return (
          <>
            <PageHeader
              title={groupLabel}
              description={group.data.description ?? undefined}
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
                  label: groupLabel,
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
          </>
        );
      })}
    </ContentLayout>
  );
};
