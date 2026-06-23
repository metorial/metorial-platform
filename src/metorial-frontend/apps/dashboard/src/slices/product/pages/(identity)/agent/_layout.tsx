import { InitialLoadBoundary, renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useAgent,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { LinkTabs } from '@metorial/ui';
import { Outlet, useLocation, useParams } from 'react-router-dom';

export let AgentLayout = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let location = useLocation();
  let { agentId } = useParams();
  let agent = useAgent(instance.data?.id, agentId);

  return (
    <ContentLayout>
      <PageHeader
        title={agent.data?.name ?? '...'}
        description={agent.data?.description ?? undefined}
        pagination={[
          {
            label: 'Agents',
            href: Paths.instance.identity.agents(
              organization.data,
              project.data,
              instance.data
            )
          },
          {
            label: agent.data?.name ?? agentId ?? '...',
            href: Paths.instance.identity.agent(
              organization.data,
              project.data,
              instance.data,
              agent.data?.id ?? agentId
            )
          }
        ]}
      />

      <InitialLoadBoundary>
        {renderWithLoader({ instance, organization, project, agent })(
          ({ instance, organization, project, agent }) => (
            <>
              <LinkTabs
                current={location.pathname}
                links={[
                  {
                    label: 'Overview',
                    to: Paths.instance.identity.agent(
                      organization.data,
                      project.data,
                      instance.data,
                      agent.data.id
                    )
                  },
                  {
                    label: 'Operations',
                    to: Paths.instance.identity.agent(
                      organization.data,
                      project.data,
                      instance.data,
                      agent.data.id,
                      'operations'
                    )
                  },
                  {
                    label: 'Connections',
                    to: Paths.instance.identity.agent(
                      organization.data,
                      project.data,
                      instance.data,
                      agent.data.id,
                      'connections'
                    )
                  },
                  {
                    label: 'Delegations',
                    to: Paths.instance.identity.agent(
                      organization.data,
                      project.data,
                      instance.data,
                      agent.data.id,
                      'delegations'
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
