import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useSession
} from '@metorial/state';
import { Entity, RenderDate, Spacer, Text } from '@metorial/ui';
import { useParams } from 'react-router-dom';
import { Link } from 'react-router-dom';

export let ProviderSessionProvidersPage = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();

  let { sessionId } = useParams();
  let session = useSession(instance.data?.id, sessionId);

  return renderWithLoader({ session })(({ session }) => {
    let deployments = session.data?.providerDeployments ?? [];

    return (
      <>
        <Spacer size={15} />

        {deployments.length === 0 ? (
          <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
            No provider deployments in this session.
          </Text>
        ) : (
          deployments.map(dep => (
            <Link
              key={dep.id}
              to={
                dep.providerDeploymentId
                  ? Paths.instance.providerDeployment(
                      organization.data,
                      project.data,
                      instance.data,
                      dep.providerDeploymentId
                    )
                  : '#'
              }
            >
              <Entity.Wrapper>
                <Entity.Content>
                  <Entity.Field title={dep.name ?? 'Unnamed'} />

                  <Entity.Field
                    title={<Text size="2">{dep.name ?? dep.providerId}</Text>}
                    value={<RenderDate date={session.data.createdAt} />}
                  />
                </Entity.Content>
              </Entity.Wrapper>
            </Link>
          ))
        )}
      </>
    );
  });
};
