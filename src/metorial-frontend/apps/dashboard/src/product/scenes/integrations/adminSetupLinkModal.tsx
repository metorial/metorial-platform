import type { DashboardInstanceProviderDeploymentsSetupSessionsCreateOutput } from '@metorial/dashboard-sdk';
import { useForm } from '@metorial/data-hooks';
import { IntegrationProvider, useCreateProviderSetupSession } from '@metorial/state';
import {
  Button,
  Copy,
  Dialog,
  Input,
  RenderDate,
  Spacer,
  Text,
  showModal
} from '@metorial/ui';
import { useState } from 'react';
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
}) =>
  showModal(({ dialogProps, close }) => {
    let createSetupSession = useCreateProviderSetupSession(
      p.instanceId,
      p.integrationProvider.providerId,
      p.integrationProvider.deploymentId
    );
    let [created, setCreated] =
      useState<DashboardInstanceProviderDeploymentsSetupSessionsCreateOutput | null>(null);

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
              <Button
                type="submit"
                loading={createSetupSession.isLoading}
                success={createSetupSession.isSuccess}
              >
                Create Admin Setup Link
              </Button>
            </Dialog.Actions>

            <createSetupSession.RenderError />
          </form>
        )}
      </Dialog.Wrapper>
    );
  });
