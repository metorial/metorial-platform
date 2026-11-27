import type { DashboardInstanceProviderDeploymentsSetupSessionsCreateOutput } from '@metorial/dashboard-sdk';
import { useForm } from '@metorial/data-hooks';
import { IntegrationProvider, useCreateProviderSetupSession } from '@metorial/state';
import {
  Button,
  Callout,
  Copy,
  Dialog,
  Input,
  RenderDate,
  Spacer,
  Text,
  showModal
} from '@metorial/ui';
import { useState } from 'react';
import { closeAndThen } from '../providerAuthConfigs/modalHelpers';
import { isProviderSetupCredentialError } from '../providerDeployments/setupSessionRunner';
import { AdminSetupLinkEmailSection } from './adminSetupLinkEmailSection';

export type AdminSetupIntegrationProvider = Pick<
  IntegrationProvider,
  'providerId' | 'deploymentId' | 'authMethodId' | 'authCredentialsId' | 'authMethod'
>;

export let supportsAdminSetup = (integrationProvider: AdminSetupIntegrationProvider) =>
  integrationProvider.authMethod?.capabilities?.adminSetup?.enabled === true;

export let requiresAdminSetup = (integrationProvider: AdminSetupIntegrationProvider) =>
  supportsAdminSetup(integrationProvider) &&
  integrationProvider.authMethod?.capabilities?.adminSetup?.required === true;

export let showAdminSetupLinkModal = (p: {
  instanceId: string;
  integrationProvider: AdminSetupIntegrationProvider;
  providerName: string;
  onConfigure?: () => void;
}) =>
  showModal(({ dialogProps, close }) => {
    let createSetupSession = useCreateProviderSetupSession(
      p.instanceId,
      p.integrationProvider.providerId,
      p.integrationProvider.deploymentId
    );
    let [created, setCreated] =
      useState<DashboardInstanceProviderDeploymentsSetupSessionsCreateOutput | null>(null);
    let needsOAuthApp = isProviderSetupCredentialError(
      createSetupSession.error ?? undefined,
      p.integrationProvider.authCredentialsId ?? undefined
    );

    let form = useForm({
      initialValues: {
        name: `${p.providerName} Admin Setup`,
        description: ''
      },
      onSubmit: async values => {
        let [setupSession] = await createSetupSession.mutate({
          type: 'admin',
          name: values.name.trim(),
          description: values.description.trim() || undefined,
          providerAuthMethodId: p.integrationProvider.authMethodId ?? undefined,
          providerAuthCredentialsId: p.integrationProvider.authCredentialsId ?? undefined
        });

        if (!setupSession) return;
        setCreated(setupSession);
      },
      schema: yup =>
        yup.object({
          name: yup.string().trim().required('Name is required')
        })
    });

    return (
      <Dialog.Wrapper {...dialogProps} width={650}>
        <Dialog.Title>Create Admin Setup Link</Dialog.Title>
        {!created && (
          <Dialog.Description>
            Create a link for an administrator to approve {p.providerName} for their
            organization. Once approved, everyone in their organization can connect it.
          </Dialog.Description>
        )}

        {created ? (
          <>
            <Text size="2" color="gray600">
              Share this link with an administrator of the organization you want to connect. It
              expires on <RenderDate date={created.expiresAt} />.
            </Text>
            <Spacer size={12} />
            <Copy label="Admin Setup Link" value={created.url} />

            <Spacer size={24} />

            <AdminSetupLinkEmailSection
              instanceId={p.instanceId}
              setupSessionId={created.id}
            />

            <Spacer size={18} />

            <Dialog.Actions>
              <Button type="button" variant="outline" onClick={close}>
                Close
              </Button>
              <Button
                type="button"
                onClick={() => window.open(created.url, '_blank', 'noopener,noreferrer')}
              >
                Open
              </Button>
            </Dialog.Actions>
          </>
        ) : (
          <form onSubmit={form.handleSubmit}>
            {needsOAuthApp && (
              <>
                <Callout color="orange">
                  This integration’s OAuth app is unavailable. Update the app in the provider
                  settings before creating an admin setup link.
                </Callout>
                <Spacer size={16} />
              </>
            )}
            <Input label="Name" required {...form.getFieldProps('name')} />
            <form.RenderError field="name" />

            <Spacer size={10} />

            <Input label="Description" {...form.getFieldProps('description')} />

            <Spacer size={18} />

            <Dialog.Actions>
              <Button
                type="button"
                variant="outline"
                disabled={createSetupSession.isLoading}
                onClick={close}
              >
                Cancel
              </Button>
              {needsOAuthApp ? (
                p.onConfigure && (
                  <Button type="button" onClick={() => closeAndThen(close, p.onConfigure)}>
                    Configure Provider
                  </Button>
                )
              ) : (
                <Button
                  type="submit"
                  loading={createSetupSession.isLoading}
                  success={createSetupSession.isSuccess}
                >
                  Create Admin Setup Link
                </Button>
              )}
            </Dialog.Actions>

            {!needsOAuthApp && <createSetupSession.RenderError />}
          </form>
        )}
      </Dialog.Wrapper>
    );
  });
