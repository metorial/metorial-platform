import { renderWithLoader, useForm } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useProvider,
  useProviderAuthCredential,
  useProviderAuthMethods
} from '@metorial/state';
import { Button, Callout, Checkbox, Flex, Input, Spacer, Text } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import styled from 'styled-components';
import { DeleteResourceDangerZone } from '../../../scenes/deleteResourceDangerZone';
import { getFromDeployment } from '../fromDeployment';

let ScopesList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

let ScopeItem = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 4px;
`;

export let ProviderAuthCredentialSettingsPage = () => {
  let instance = useCurrentInstance();
  let navigate = useNavigate();
  let location = useLocation();

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

  let [selectedScopes, setSelectedScopes] = useState<Set<string> | null>(null);

  let credentialScopes = credential.data?.scopes;
  let effectiveScopes =
    selectedScopes ?? new Set(credentialScopes ?? availableScopes.map(s => s.scope));

  let updateMutator = credential.useUpdateMutator();
  let scopesMutator = credential.useUpdateMutator();
  let deleteMutator = credential.useDeleteMutator();
  let fromDeploymentId = getFromDeployment(location.search);
  let form = useForm({
    initialValues: {
      name: credential.data?.name ?? '',
      description: credential.data?.description ?? ''
    },
    updateInitialValues: true,
    onSubmit: async values => {
      await updateMutator.mutate({
        name: values.name.trim(),
        description: values.description || undefined
      });
    },
    schema: yup =>
      yup.object({
        name: yup.string().trim().required('Name is required'),
        description: yup.string()
      }) as any
  });

  let toggleScope = (scope: string) => {
    let next = new Set(effectiveScopes);
    if (next.has(scope)) {
      next.delete(scope);
    } else {
      next.add(scope);
    }
    setSelectedScopes(next);
  };

  let saveScopes = async () => {
    // if (credential.data?.isManaged) return;
    await scopesMutator.mutate({ scopes: [...effectiveScopes] });
  };

  return renderWithLoader({ credential })(({ credential }) => (
    <>
      <Box
        title="Auth Credential Settings"
        description="Modify the settings of this auth credential."
      >
        <form onSubmit={form.handleSubmit}>
          <Input label="Name" {...form.getFieldProps('name')} />
          <form.RenderError field="name" />

          <Spacer size={15} />

          <Input label="Description" {...form.getFieldProps('description')} />
          <form.RenderError field="description" />

          <Spacer size={15} />

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              size="2"
              type="submit"
              loading={updateMutator.isLoading}
              success={updateMutator.isSuccess}
            >
              Save
            </Button>
          </div>

          <updateMutator.RenderError />
        </form>
      </Box>

      {availableScopes.length > 0 && (
        <>
          <Spacer size={20} />

          <Box
            title="Scopes"
            description="Select which OAuth scopes this credential should request."
          >
            <ScopesList>
              {availableScopes.map(scope => (
                <ScopeItem key={scope.id}>
                  <Checkbox
                    checked={effectiveScopes.has(scope.scope)}
                    onCheckedChange={() => toggleScope(scope.scope)}
                    label={
                      <Flex direction="column" gap={2}>
                        <Text size="2" weight="medium">
                          {scope.name}
                        </Text>
                        {scope.description && (
                          <Text size="1" color="gray600">
                            {scope.description}
                          </Text>
                        )}
                      </Flex>
                    }
                  />
                </ScopeItem>
              ))}
            </ScopesList>

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

      <Spacer size={20} />

      <DeleteResourceDangerZone
        description="Delete these auth credentials and remove them from your saved provider authentication settings."
        buttonLabel="Delete Auth Credentials"
        confirmTitle="Delete auth credentials"
        confirmDescription="Are you sure you want to delete these auth credentials?"
        loading={deleteMutator.isLoading}
        success={deleteMutator.isSuccess}
        disabled={credential.data.isManaged}
        onDelete={async () => {
          let [res] = await deleteMutator.mutate({});
          if (!res) return;

          navigate(
            fromDeploymentId
              ? Paths.instance.providerDeployment(
                  instance.data?.organization,
                  instance.data?.project,
                  instance.data,
                  fromDeploymentId,
                  'auth-credentials'
                )
              : Paths.instance.providerAuthCredentials(
                  instance.data?.organization,
                  instance.data?.project,
                  instance.data
                )
          );
        }}
      >
        {credential.data.isManaged ? (
          <Callout color="blue">
            Managed auth credentials cannot be deleted from the dashboard.
          </Callout>
        ) : null}
      </DeleteResourceDangerZone>
    </>
  ));
};
