import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useProvider, useProviderAuthCredential } from '@metorial/state';
import { Attributes, Callout, RenderDate, Spacer } from '@metorial/ui';
import { Box, ID } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';
import { ProviderAuthErrorsTable } from '../../../scenes/providerAuthErrors/table';

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
            content: credential.data.isDefault ? 'Yes' : 'No'
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

      <Spacer size={12} />

      <Box
        title="Auth Errors"
        description="Recent authentication failures captured for this credential."
      >
        <ProviderAuthErrorsTable
          providerAuthCredentialsId={credential.data.id}
          emptyText="No auth errors have been captured for this credential yet."
          linkToDetail
        />
      </Box>
    </>
  ));
};
