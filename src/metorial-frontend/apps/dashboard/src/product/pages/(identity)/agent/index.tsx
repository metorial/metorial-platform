import { renderWithLoader } from '@metorial/data-hooks';
import {
  useAgent,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { Attributes, RenderDate, Spacer, Text } from '@metorial/ui';
import { Box, ID } from '@metorial/ui-product';
import { Link, useParams } from 'react-router-dom';
import { useIdentityPaths } from '../../../lib/identityPaths';
import { AgentInstancesTable } from '../../../scenes/identity/agentInstancesTable';

export let AgentPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let identityPaths = useIdentityPaths();
  let { agentId } = useParams();
  let agent = useAgent(instance.data?.id, agentId);

  return renderWithLoader({ instance, organization, project, agent })(
    ({ instance, organization, project, agent }) => (
      <>
        <Attributes
          itemWidth="300px"
          attributes={[
            {
              label: 'ID',
              content: <ID id={agent.data.id} />
            },
            {
              label: 'Type',
              content: agent.data.type
            },
            {
              label: 'Status',
              content: agent.data.status
            },
            {
              label: 'Linked Actor',
              content: (
                <Link
                  to={identityPaths.actor(
                    organization.data,
                    project.data,
                    instance.data,
                    agent.data.actorId
                  )}
                >
                  {agent.data.actorId}
                </Link>
              )
            },
            {
              label: 'Slug',
              content: agent.data.slug
            },
            {
              label: 'Created At',
              content: <RenderDate date={agent.data.createdAt} />
            }
          ]}
        />

        {agent.data.metadata ? (
          <>
            <Spacer size={20} />
            <Box title="Metadata" description="Arbitrary metadata attached to this agent.">
              <Text size="2" style={{ whiteSpace: 'pre-wrap' }}>
                {JSON.stringify(agent.data.metadata, null, 2)}
              </Text>
            </Box>
          </>
        ) : null}

        <Spacer size={20} />

        <Box
          title="Agent Instances"
          description="Clients and runtime instances currently linked to this agent."
        >
          <AgentInstancesTable instanceId={instance.data.id} agentId={agent.data.id} />
        </Box>
      </>
    )
  );
};
