import { renderWithLoader } from '@metorial/data-hooks';
import {
  useCurrentInstance,
  useProviderAuthCredential,
  useProviderDeployment
} from '@metorial/state';
import { Attributes, Badge, Callout, RenderDate, Spacer } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';

export let ProviderAuthCredentialOverviewPage = () => {
  let instance = useCurrentInstance();

  let { providerDeploymentId, providerAuthCredentialsId } = useParams();
  let deployment = useProviderDeployment(instance.data?.id, providerDeploymentId);
  let credential = useProviderAuthCredential(instance.data?.id, providerAuthCredentialsId);

  return renderWithLoader({ credential })(({ credential }) => (
    <>
      {credential.data.isManaged && (
        <>
          <Callout color="blue">Managed by Metorial.</Callout>
          <Spacer size={12} />
        </>
      )}
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
            label: 'Default',
            content: credential.data.isDefault ? (
              <Badge color="blue">Default</Badge>
            ) : (
              'No'
            )
          },
          {
            label: 'Provider',
            content: deployment.data?.providerId ?? '—'
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
