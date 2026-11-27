import type { DashboardInstancePublicMcpServersCreateOutput } from '@metorial/dashboard-sdk';
import { useForm } from '@metorial/data-hooks';
import {
  useCreatePublicMcpServer,
  useProviderDeployments,
  usePublicMcpServerSlugAvailability
} from '@metorial/state';
import { Button, Combobox, Dialog, Input, showModal, Spacer, Text } from '@metorial/ui';
import { useDebounced } from '@metorial/use-debounced';
import { useState } from 'react';
import { isValidPublicMcpSlug, slugifyPublicMcpName } from './shared';

let useDeploymentOptions = (instanceId: string, searchQuery?: string) => {
  let deployments = useProviderDeployments(instanceId, {
    limit: 25,
    search: searchQuery || undefined
  });

  return {
    items: (deployments.data?.items ?? []).map(deployment => ({
      id: deployment.id,
      label: deployment.name ?? deployment.id,
      description: deployment.description ?? undefined
    })),
    isLoading: deployments.isLoading,
    empty: searchQuery ? 'No matching deployments found.' : 'No deployments available.'
  };
};

let SlugAvailability = ({ instanceId, slug }: { instanceId: string; slug: string }) => {
  let debouncedSlug = useDebounced(slug, 300);
  let isValid = isValidPublicMcpSlug(debouncedSlug);
  let availability = usePublicMcpServerSlugAvailability(
    instanceId,
    isValid ? debouncedSlug : null
  );

  if (!slug) return null;

  if (!isValidPublicMcpSlug(slug)) {
    return (
      <>
        <Spacer height={3} />
        <Text size="1" color="gray600">
          Use 3 to 48 lowercase letters, numbers, and single dashes.
        </Text>
      </>
    );
  }

  if (slug !== debouncedSlug || !availability.data) return null;

  return availability.data.isAvailable ? (
    <>
      <Spacer height={3} />

      <Text size="1" color="green800">
        This identifier is available.
      </Text>
    </>
  ) : (
    <>
      <Text size="1" color="red600">
        This identifier is already taken.
      </Text>

      <Spacer height={3} />
    </>
  );
};

export let showCreatePublicMcpServerDialog = (p: {
  instanceId: string;
  providerDeploymentId?: string;
  onCreate?: (server: DashboardInstancePublicMcpServersCreateOutput) => void;
}) =>
  showModal(({ dialogProps, close }) => {
    let createServer = useCreatePublicMcpServer();
    let [slugTouched, setSlugTouched] = useState(false);
    let [deploymentLabel, setDeploymentLabel] = useState<string | undefined>();

    let form = useForm({
      initialValues: {
        name: '',
        slug: '',
        description: '',
        providerDeploymentId: p.providerDeploymentId ?? ''
      },
      onSubmit: async values => {
        let [server] = await createServer.mutate({
          instanceId: p.instanceId,
          providerDeploymentId: values.providerDeploymentId,
          name: values.name.trim(),
          slug: values.slug,
          description: values.description.trim() || undefined
        });
        if (!server) return;

        close();
        p.onCreate?.(server);
      },
      schema: yup =>
        yup.object({
          name: yup.string().trim().required('Name is required'),
          slug: yup
            .string()
            .required('Identifier is required')
            .test('slug', 'Identifier is not valid', value =>
              isValidPublicMcpSlug(value ?? '')
            ),
          description: yup.string(),
          providerDeploymentId: yup.string().required('Select a deployment')
        })
    });

    return (
      <Dialog.Wrapper {...dialogProps} width={600}>
        <Dialog.Title>Create Public MCP Server</Dialog.Title>
        <Dialog.Description>
          Publish a provider deployment at a public URL. Anyone with the URL can connect from
          an MCP client, and each user signs in with their own credentials.
        </Dialog.Description>

        <form onSubmit={form.handleSubmit}>
          <Input
            label="Name"
            required
            {...form.getFieldProps('name')}
            onChange={e => {
              form.setFieldValue('name', e.target.value);
              if (!slugTouched)
                form.setFieldValue('slug', slugifyPublicMcpName(e.target.value));
            }}
          />
          <form.RenderError field="name" />

          <Spacer height={15} />

          <Input
            label="Identifier"
            description="Part of the public URL. Changing it later breaks existing connections."
            required
            {...form.getFieldProps('slug')}
            onChange={e => {
              setSlugTouched(true);
              form.setFieldValue('slug', e.target.value.trim().toLowerCase());
            }}
          />
          <form.RenderError field="slug" />
          <SlugAvailability instanceId={p.instanceId} slug={form.values.slug} />

          <Spacer height={15} />

          <Combobox
            label="Deployment"
            description="The provider deployment that users connect to."
            required
            placeholder="Search deployments"
            value={form.values.providerDeploymentId || null}
            valueLabel={deploymentLabel}
            provider={({ searchQuery }) => useDeploymentOptions(p.instanceId, searchQuery)}
            onChange={(value, item) => {
              form.setFieldValue('providerDeploymentId', value ?? '');
              setDeploymentLabel(typeof item?.label == 'string' ? item.label : undefined);
            }}
          />
          <form.RenderError field="providerDeploymentId" />

          <Spacer height={15} />

          <Input label="Description" {...form.getFieldProps('description')} />
          <form.RenderError field="description" />

          <Spacer height={15} />

          <createServer.RenderError />

          <Dialog.Actions>
            <Button
              size="1"
              variant="soft"
              type="button"
              disabled={createServer.isLoading}
              onClick={close}
            >
              Cancel
            </Button>
            <Button
              size="1"
              type="submit"
              loading={createServer.isLoading}
              success={createServer.isSuccess}
            >
              Create Public MCP Server
            </Button>
          </Dialog.Actions>
        </form>
      </Dialog.Wrapper>
    );
  });
