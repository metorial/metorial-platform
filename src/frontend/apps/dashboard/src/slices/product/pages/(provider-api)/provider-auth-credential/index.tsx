import { renderWithLoader } from '@metorial/data-hooks';
import {
  useCurrentInstance,
  useProviderAuthCredential,
  useProviderDeployment
} from '@metorial/state';
import { Attributes, RenderDate } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';

export let ProviderAuthCredentialOverviewPage = () => {
  let instance = useCurrentInstance();

  let { providerDeploymentId, providerAuthCredentialsId } = useParams();
  let deployment = useProviderDeployment(instance.data?.instanceId, providerDeploymentId);
  let credential = useProviderAuthCredential(
    instance.data?.instanceId,
    providerDeploymentId,
    providerAuthCredentialsId
  );

  return renderWithLoader({ credential })(({ credential }) => (
    <>
      <Attributes
        itemWidth="250px"
        attributes={[
          {
            label: 'Name',
            content: credential.data.name ?? '—'
          },
          {
            label: 'Description',
            content: credential.data.description ?? '—'
          },
          {
            label: 'ID',
            content: <ID id={credential.data.id} />
          },
          {
            label: 'Type',
            content: credential.data.type ?? '—'
          },
          {
            label: 'Provider',
            content: deployment.data?.provider?.name ?? deployment.data?.providerId ?? '—'
          },
          {
            label: 'Deployment',
            content: deployment.data?.name ?? '—'
          },
          {
            label: 'Created',
            content: credential.data.createdAt ? (
              <RenderDate date={credential.data.createdAt} />
            ) : (
              '—'
            )
          },
          {
            label: 'Updated',
            content: credential.data.updatedAt ? (
              <RenderDate date={credential.data.updatedAt} />
            ) : (
              '—'
            )
          }
        ]}
      />
    </>
  ));
};
