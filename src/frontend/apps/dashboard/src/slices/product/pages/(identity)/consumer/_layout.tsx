import { InitialLoadBoundary, renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useConsumer,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { LinkTabs } from '@metorial/ui';
import { Outlet, useLocation, useParams } from 'react-router-dom';

export let ConsumerLayout = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let { consumerId } = useParams();
  let consumer = useConsumer(instance.data?.id, consumerId);
  let pathname = useLocation().pathname;

  return (
    <ContentLayout>
      <PageHeader
        title={consumer.data?.name ?? '...'}
        description={consumer.data?.email ?? undefined}
        pagination={[
          {
            label: 'Accounts',
            href: Paths.instance.identity.consumers(
              organization.data,
              project.data,
              instance.data
            )
          },
          {
            label: consumer.data?.name ?? '...',
            href: Paths.instance.identity.consumer(
              organization.data,
              project.data,
              instance.data,
              consumer.data?.id ?? consumerId
            )
          }
        ]}
      />

      <InitialLoadBoundary>
        {renderWithLoader({ instance, organization, project, consumer })(
          ({ instance, organization, project, consumer }) => (
            <>
              <LinkTabs
                current={pathname}
                links={[
                  {
                    label: 'Overview',
                    to: Paths.instance.identity.consumer(
                      organization.data,
                      project.data,
                      instance.data,
                      consumer.data.id
                    )
                  },
                  {
                    label: 'Operations',
                    to: Paths.instance.identity.consumer(
                      organization.data,
                      project.data,
                      instance.data,
                      consumer.data.id,
                      'operations'
                    )
                  },
                  {
                    label: 'Connections',
                    to: Paths.instance.identity.consumer(
                      organization.data,
                      project.data,
                      instance.data,
                      consumer.data.id,
                      'connections'
                    )
                  },
                  {
                    label: 'Delegations',
                    to: Paths.instance.identity.consumer(
                      organization.data,
                      project.data,
                      instance.data,
                      consumer.data.id,
                      'delegations'
                    )
                  },
                  {
                    label: 'Magic MCP Servers',
                    to: Paths.instance.identity.consumer(
                      organization.data,
                      project.data,
                      instance.data,
                      consumer.data.id,
                      'magic-mcp-servers'
                    )
                  },
                  {
                    label: 'Settings',
                    to: Paths.instance.identity.consumer(
                      organization.data,
                      project.data,
                      instance.data,
                      consumer.data.id,
                      'settings'
                    )
                  }
                ]}
              />

              <Outlet />
            </>
          )
        )}
      </InitialLoadBoundary>
    </ContentLayout>
  );
};
