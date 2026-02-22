import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useSession } from '@metorial/state';
import { Entity, Text } from '@metorial/ui';
import { Link, useParams } from 'react-router-dom';

export let SessionDeploymentsPage = () => {
  let instance = useCurrentInstance();

  let { sessionId } = useParams();
  let session = useSession(instance.data?.id, sessionId);

  return renderWithLoader({ session })(({ session }) => {
    let deployments = session.data?.providers ?? [];

    if (deployments.length === 0) {
      return (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No deployments found.
        </Text>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {deployments.map(deployment => {
          let content = (
            <Entity.Wrapper>
              <Entity.Content>
                <Entity.Field
                  title={deployment.deployment?.name ?? deployment.providerId}
                  description={`Session Deployment ID: ${deployment.id}`}
                />
              </Entity.Content>
            </Entity.Wrapper>
          );

          if (!deployment.deployment?.id) {
            return <div key={deployment.id}>{content}</div>;
          }

          return (
            <Link
              key={deployment.id}
              to={Paths.instance.serverDeployment(
                instance.data?.organization,
                instance.data?.project,
                instance.data,
                deployment.deployment.id
              )}
            >
              {content}
            </Link>
          );
        })}
      </div>
    );
  });
};
