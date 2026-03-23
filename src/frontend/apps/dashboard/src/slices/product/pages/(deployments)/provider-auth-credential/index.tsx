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
          <Callout color="blue">
            These credentials are managed by Metorial. They can be used from the
            dashboard, but they can only be edited from the admin dashboard.
          </Callout>
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
            label: 'Origin',
            content: credential.data.isManaged ? (
              <Badge color="gray">Managed by Metorial</Badge>
            ) : (
              <Badge color="blue">Tenant-owned</Badge>
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
