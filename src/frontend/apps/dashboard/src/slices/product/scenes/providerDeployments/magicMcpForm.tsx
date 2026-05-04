import { DashboardInstanceMagicMcpServersGetOutput } from '@metorial/dashboard-sdk';
import { renderWithLoader, useForm } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCreateMagicMcpServerProvider,
  useCreateMagicMcpServer,
  useCurrentInstance,
  useMagicMcpServer,
  useUpdateMagicMcpServerProvider
} from '@metorial/state';
import { Button, confirm, Input, Spacer, toast } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { showAddProviderSidePanel } from '../sessionTemplates/providersManager';

export type MagicMcpServerFormProps =
  | { type: 'update'; magicMcpServerId: string; for?: undefined }
  | { type: 'create'; for?: { providerId?: string } };

export let MagicMcpServerForm = (
  p: MagicMcpServerFormProps & {
    close?: () => any;
    extraActions?: React.ReactNode;
    onCreate?: (server: DashboardInstanceMagicMcpServersGetOutput) => any;
  }
) => {
  let instance = useCurrentInstance();
  let navigate = useNavigate();

  let createMutator = useCreateMagicMcpServer();
  let createProviderMutator = useCreateMagicMcpServerProvider();
  let updateProviderMutator = useUpdateMagicMcpServerProvider();

  let server = useMagicMcpServer(
    instance.data?.id,
    p.type === 'update' ? p.magicMcpServerId : undefined
  );
  let updateMutator = server.useUpdateMutator();
  let deleteMutator = server.useDeleteMutator();

  let form = useForm({
    initialValues: {
      name: p.type === 'update' ? (server.data?.name ?? '') : '',
      description: p.type === 'update' ? (server.data?.description ?? '') : ''
    },
    updateInitialValues: true,
    schema: yup =>
      yup.object({
        name: yup.string().required('Name is required'),
        description: yup.string().optional()
      }),
    onSubmit: async values => {
      if (!instance.data) return;

      if (p.type === 'update') {
        let [res] = await updateMutator.mutate({
          name: values.name,
          description: values.description || undefined
        });
        if (res) {
          toast.success('Magic MCP server updated');
          p.close?.();
        }
        return;
      }

      let [res] = await createMutator.mutate({
        instanceId: instance.data.id,
        name: values.name,
        description: values.description || undefined
      });
      if (!res) return;

      p.close?.();

      showAddProviderSidePanel({
        title: 'Configure Magic MCP Server',
        description: 'Set up authentication and other settings for this Magic MCP server.',
        action: 'Create Magic MCP Server',

        instanceId: instance.data.id,
        providerId: p.type === 'create' ? p.for?.providerId : undefined,
        onSubmitProvider: async (input, currentProviderId) => {
          if (currentProviderId) {
            let [, error] = await updateProviderMutator.mutate({
              instanceId: instance.data!.id,
              magicMcpServerId: res.id,
              magicMcpServerProviderId: currentProviderId,
              providerDeploymentId: input.providerDeploymentId,
              providerConfigId: input.providerConfigId,
              providerAuthConfigId: input.providerAuthConfigId,
              toolFilters: input.toolFilters
            });

            return error ? { error } : { success: true };
          }

          let [, error] = await createProviderMutator.mutate({
            instanceId: instance.data!.id,
            magicMcpServerId: res.id,
            providerId: input.providerId,
            providerDeploymentId: input.providerDeploymentId!,
            providerConfigId: input.providerConfigId,
            providerAuthConfigId: input.providerAuthConfigId,
            toolFilters: input.toolFilters
          });

          return error ? { error } : { success: true };
        },
        onComplete: () => {
          if (p.onCreate) {
            p.onCreate(res);
            return;
          }

          navigate(
            Paths.instance.magicMcp.server(
              instance.data.organization,
              instance.data.project,
              instance.data,
              res.id
            )
          );
        }
      });
    }
  });

  if (p.type === 'update') {
    return renderWithLoader({ server })(() => (
      <>
        <Box
          title="Magic MCP Server Settings"
          description="Modify the settings of this Magic MCP server."
        >
          <form onSubmit={form.handleSubmit}>
            <Input label="Name" {...form.getFieldProps('name')} />
            <form.RenderError field="name" />

            <Spacer size={15} />

            <Input label="Description" {...form.getFieldProps('description')} />
            <form.RenderError field="description" />

            <Spacer size={15} />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              {p.extraActions}
              {p.close && (
                <Button type="button" variant="outline" onClick={p.close}>
                  Close
                </Button>
              )}
              <Button
                type="submit"
                loading={updateMutator.isLoading}
                success={updateMutator.isSuccess}
              >
                Save
              </Button>
            </div>
          </form>
        </Box>

        <Spacer size={20} />

        <Box
          title="Delete Magic MCP Server"
          description="Permanently delete this Magic MCP server. This action cannot be undone."
        >
          <Button
            color="red"
            loading={deleteMutator.isLoading}
            success={deleteMutator.isSuccess}
            onClick={() =>
              confirm({
                title: 'Delete Magic MCP Server',
                description: 'Are you sure you want to delete this Magic MCP server?',
                onConfirm: async () => {
                  let [res] = await deleteMutator.mutate({});
                  if (!res || !instance.data) return;

                  toast.success('Magic MCP server deleted');
                  navigate(
                    Paths.instance.magicMcp.servers(
                      instance.data.organization,
                      instance.data.project,
                      instance.data
                    )
                  );
                }
              })
            }
          >
            Delete
          </Button>
        </Box>
      </>
    ));
  }

  return (
    <form onSubmit={form.handleSubmit}>
      <Input label="Name" {...form.getFieldProps('name')} />
      <form.RenderError field="name" />

      <Spacer size={15} />

      <Input label="Description" {...form.getFieldProps('description')} />
      <form.RenderError field="description" />

      <Spacer size={15} />

      <createMutator.RenderError />
      <updateMutator.RenderError />

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        {p.close && (
          <Button type="button" variant="outline" onClick={p.close}>
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          loading={createMutator.isLoading}
          success={createMutator.isSuccess}
        >
          Continue
        </Button>
      </div>
    </form>
  );
};
