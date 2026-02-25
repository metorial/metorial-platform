import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useSession
} from '@metorial/state';
import { RenderDate, Text } from '@metorial/ui';
import { Table } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';

export let ProviderSessionProvidersPage = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();

  let { sessionId } = useParams();
  let session = useSession(instance.data?.id, sessionId);

  return renderWithLoader({ session })(({ session }) => {
    let deployments = session.data?.providers ?? [];

    return (
      <>
        <Table
          headers={['Deployment', 'Provider', 'Created']}
          data={deployments.map(dep => ({
            data: [
              <Text size="2" weight="strong">
                {dep.deployment?.name ?? 'Unnamed'}
              </Text>,
              <Text size="2">{dep.providerId}</Text>,
              <RenderDate date={session.data.createdAt} />
            ],
            href: dep.deployment?.id
              ? Paths.instance.providerDeployment(
                  organization.data,
                  project.data,
                  instance.data,
                  dep.deployment.id
                )
              : undefined
          }))}
        />

        {deployments.length === 0 && (
          <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
            No provider deployments in this session.
          </Text>
        )}
      </>
    );
  });
};
