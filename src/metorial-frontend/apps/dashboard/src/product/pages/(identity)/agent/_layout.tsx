import { InitialLoadBoundary, renderWithLoader } from '@metorial/data-hooks';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useAgent,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { LinkTabs } from '@metorial/ui';
import { Outlet, useLocation, useParams } from 'react-router-dom';
import { useIdentityPaths } from '../../../lib/identityPaths';

export let AgentLayout = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let identityPaths = useIdentityPaths();
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
            href: identityPaths.agents(organization.data, project.data, instance.data)
          },
          {
            label: agent.data?.name ?? agentId ?? '...',
            href: identityPaths.agent(
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
                    to: identityPaths.agent(
                      organization.data,
                      project.data,
                      instance.data,
                      agent.data.id
                    )
                  },
                  {
                    label: 'Operations',
                    to: identityPaths.agent(
                      organization.data,
                      project.data,
                      instance.data,
                      agent.data.id,
                      'operations'
                    )
                  },
                  {
                    label: 'Connections',
                    to: identityPaths.agent(
                      organization.data,
                      project.data,
                      instance.data,
                      agent.data.id,
                      'connections'
                    )
                  },
                  {
                    label: 'Delegations',
                    to: identityPaths.agent(
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
