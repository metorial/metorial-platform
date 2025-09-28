import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useCustomServer
} from '@metorial/state';
import { Callout, LinkTabs, Spacer } from '@metorial/ui';
import { Outlet, useLocation, useParams } from 'react-router-dom';

export let CustomServerLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();

  let { customServerId } = useParams();
  let customServer = useCustomServer(instance.data?.id, customServerId);

  let pathname = useLocation().pathname;

  let pathParams = [
    organization.data,
    project.data,
    instance.data,
    customServer.data?.id ?? customServerId
  ] as const;

  return (
    <ContentLayout>
      <PageHeader
        title={customServer.data?.name ?? '...'}
        pagination={[
          {
            label: customServer.data?.type == 'remote' ? 'External Servers' : 'Custom Servers',
            href:
              customServer.data?.type == 'remote'
                ? Paths.instance.externalServers(
                    organization.data,
                    project.data,
                    instance.data
                  )
                : '#'
          },
          {
            label: customServer.data?.name,
            href: Paths.instance.customServer(...pathParams)
          }
        ]}
      />

      {renderWithLoader({ customServer })(({ customServer }) => (
        <>
          <LinkTabs
            current={pathname}
            links={[
              {
                label: 'Overview',
                to: Paths.instance.customServer(...pathParams)
              },

              ...(customServer.data?.type === 'managed'
                ? [
                    {
                      label: 'Code',
                      to: Paths.instance.customServer(...pathParams, 'code')
                    }
                  ]
                : []),

              {
                label: 'Versions',
                to: Paths.instance.customServer(...pathParams, 'versions')
              },
              {
                label: 'Deployments',
                to: Paths.instance.customServer(...pathParams, 'deployments')
              },
              {
                label: 'Listing',
                to: Paths.instance.customServer(...pathParams, 'listing')
              },
              {
                label: 'Settings',
                to: Paths.instance.customServer(...pathParams, 'settings')
              }
            ]}
          />

          {customServer.data?.status == 'archived' && (
            <>
              <Callout color="orange">
                This custom server is archived. It cannot be used for new connections.
              </Callout>

              <Spacer height={15} />
            </>
          )}

          <Outlet />
        </>
      ))}
    </ContentLayout>
  );
};
