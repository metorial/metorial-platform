import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useProvider, useProviderAuthCredential } from '@metorial/state';
import { Attributes, Badge, Callout, RenderDate, Spacer } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';

export let ProviderAuthCredentialOverviewPage = () => {
  let instance = useCurrentInstance();

  let { providerAuthCredentialsId } = useParams();
  let credential = useProviderAuthCredential(instance.data?.id, providerAuthCredentialsId);
  let provider = useProvider(instance.data?.id, credential.data?.providerId);

  return renderWithLoader({ credential })(({ credential }) => (
    <>
      {credential.data.isManaged && (
        <>
          <Callout color="blue">Managed by Metorial.</Callout>
          <Spacer size={12} />
        </>
      )}

      <Attributes
        itemWidth="300px"
        attributes={[
          {
            label: 'Name',
            content: credential.data.name ?? '—'
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
            content: credential.data.isDefault ? <Badge color="blue">Default</Badge> : 'No'
          },
          {
            label: 'Provider',
            content: provider.data?.name ?? '...'
          },
          {
            label: 'Created',
            content: credential.data.createdAt ? (
              <RenderDate date={credential.data.createdAt} />
            ) : (
              '—'
            )
          }
        ]}
      />
    </>
  ));
};
