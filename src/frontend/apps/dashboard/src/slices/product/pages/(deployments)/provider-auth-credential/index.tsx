import { renderWithLoader } from '@metorial/data-hooks';
import {
  useCurrentInstance,
  useProvider,
  useProviderAuthCredential,
  useProviderAuthMethods
} from '@metorial/state';
import { Attributes, Button, Callout, RenderDate, Spacer } from '@metorial/ui';
import { Box, ID } from '@metorial/ui-product';
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ProviderAuthErrorsTable } from '../../../scenes/providerAuthErrors/table';
import { ScopePicker } from './components/scopePicker';

export let ProviderAuthCredentialOverviewPage = () => {
  let instance = useCurrentInstance();

  let { providerAuthCredentialsId } = useParams();
  let credential = useProviderAuthCredential(instance.data?.id, providerAuthCredentialsId);
  let provider = useProvider(instance.data?.id, credential.data?.providerId);
  let versionId = provider.data?.currentVersion?.id;
  let authMethods = useProviderAuthMethods(
    instance.data?.id,
    versionId ? { providerVersionId: versionId } : null
  );
  let availableScopes = useMemo(() => {
    let oauthMethod = (authMethods.data?.items ?? []).find(m => m.type === 'oauth');
    return oauthMethod?.scopes ?? [];
  }, [authMethods.data?.items]);
  let [selectedScopes, setSelectedScopes] = useState<string[] | null>(null);

  let credentialScopes = credential.data?.scopes;
  let effectiveScopes =
    selectedScopes ?? credentialScopes ?? availableScopes.map(s => s.scope);
  let scopesMutator = credential.useUpdateMutator();

  let saveScopes = async () => {
    await scopesMutator.mutate({ scopes: effectiveScopes });
  };

  return renderWithLoader({ credential })(({ credential }) => (
    <>
      {credential.data.isManaged && (
        <>
          <Callout color="blue">These auth credentials are managed by Metorial.</Callout>
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

      {availableScopes.length > 0 && (
        <>
          <Spacer size={12} />

          <Box
            title="Scopes"
            description="Select which OAuth scopes this credential should request."
          >
            <ScopePicker
              scopes={availableScopes}
              selectedScopes={effectiveScopes}
              onSelectedScopesChange={setSelectedScopes}
            />

            <Spacer size={15} />

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                size="2"
                onClick={saveScopes}
                loading={scopesMutator.isLoading}
                success={scopesMutator.isSuccess}
              >
                Save
              </Button>
            </div>

            <scopesMutator.RenderError />
          </Box>
        </>
      )}
    </>
  ));
};
