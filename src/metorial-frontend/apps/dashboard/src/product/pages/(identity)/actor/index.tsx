import { renderWithLoader } from '@metorial/data-hooks';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useIdentityActor
} from '@metorial/state';
import { Attributes, RenderDate, Spacer } from '@metorial/ui';
import { Box, ID } from '@metorial/ui-product';
import { Link, useParams } from 'react-router-dom';
import { useIdentityPaths } from '../../../lib/identityPaths';
import { IdentitiesTable } from '../../../scenes/identity/identitiesTable';
import { SessionConnectionsTable } from '../../../scenes/logsTable/sessionConnectionsTable';
import { ToolCallsTable } from '../../../scenes/logsTable/toolCallsTable';
import { UsageScene } from '../../../scenes/usage/usage';

export let IdentityActorPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let identityPaths = useIdentityPaths();
  let { identityActorId } = useParams();
  let actor = useIdentityActor(instance.data?.id, identityActorId);

  return renderWithLoader({ instance, organization, project, actor })(
    ({ instance, organization, project, actor }) => (
      <>
        <Attributes
          itemWidth="240px"
          attributes={[
            {
              label: 'ID',
              content: <ID id={actor.data.id} />
            },
            {
              label: 'Type',
              content: actor.data.type
            },
            {
              label: 'Agent ID',
              content: actor.data.agentId ? (
                <Link
                  to={identityPaths.agent(
                    organization.data,
                    project.data,
                    instance.data,
                    actor.data.agentId
                  )}
                >
                  {actor.data.agentId}
                </Link>
              ) : (
                '—'
              )
            },
            {
              label: 'Created At',
              content: <RenderDate date={actor.data.createdAt} />
            }
          ]}
        />

        <Spacer size={20} />

        <Box
          title="Recent Operations"
          description="Recent tool calls associated with this actor."
        >
          <ToolCallsTable instanceId={instance.data.id} filters={{ actorId: actor.data.id }} />
        </Box>

        <Spacer size={20} />

        <Box
          title="Recent Connections"
          description="Connections associated with this actor and its agents."
        >
          <SessionConnectionsTable
            instanceId={instance.data.id}
            filters={{ actorId: actor.data.id }}
          />
        </Box>

        <Spacer size={20} />

        <UsageScene
          title="Usage"
          description="See how this actor is being used across identities, delegations, and requests."
          entities={[{ type: 'identity_actor', id: actor.data.id }]}
          entityNames={{ [actor.data.id]: actor.data.name }}
        />

        <Spacer size={20} />

        <Box title="Identities" description="Identities owned by this actor.">
          <IdentitiesTable
            instanceId={instance.data.id}
            filters={{ actorId: actor.data.id }}
          />
        </Box>
      </>
    )
  );
};
