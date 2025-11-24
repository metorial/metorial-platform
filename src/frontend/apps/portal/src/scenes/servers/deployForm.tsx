import { useForm } from '@metorial/data-hooks';
import { Button, Callout, CenteredSpinner, confirm, Input, Spacer, toast } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useServerListing } from '../../state/consumer/listings';
import { useCreateMagicMcpServer } from '../../state/consumer/magicMcpServer';
import { authenticateWithOauth } from '../../state/consumer/oauthSession';
import { useServerDeploymentTemplate } from '../../state/consumer/serverDeploymentTemplates';
import { useServerVariants } from '../../state/consumer/serverVariants';
import { useServer } from '../../state/consumer/servers';
import { usePaths } from '../../state/portal/path';
import { JsonSchemaInput } from '../jsonSchemaInput';
import { ServerSearch } from '../servers/search';

let Form = styled.form`
  display: flex;
  flex-direction: column;
`;

let ServerDeploymentFormInternal = (p: {
  serverId: string;
  serverDeploymentTemplateId: string;
  close?: () => any;
  extraActions?: React.ReactNode;
}) => {
  let template = useServerDeploymentTemplate(p.serverDeploymentTemplateId);
  let variants = useServerVariants(p.serverId);
  let listing = useServerListing(p.serverId);
  let server = useServer(p.serverId);

  let Paths = usePaths();
  let navigate = useNavigate();

  let createMutator = useCreateMagicMcpServer();

  let variant = (p as any).for?.serverVariantId
    ? variants.data?.items.find(v => v.id == (p as any).for?.serverVariantId)
    : variants.data?.items[0];

  let serverNeedsConfig =
    variant?.currentVersion?.schema &&
    Object.entries(variant?.currentVersion?.schema?.properties ?? {}).length > 0;

  let loading = listing.isLoading || variants.isLoading || server.isLoading;

  let form = useForm({
    initialValues: {
      name: template?.data?.name ?? '',
      description: template?.data?.description ?? '',
      config: {}
    },
    schema: yup =>
      yup.object({
        name: yup.string(),
        description: yup.string().optional(),
        config: yup.object()
      }),
    onSubmit: async values => {
      let [res, err] = await createMutator.mutate({
        name: values.name,
        description: values.description,
        config: values.config,
        serverId: p.serverId,
        serverVariantId: variant?.id
      });

      if (res) {
        if (
          variant?.currentVersion?.oauth.status == 'enabled' &&
          variant?.currentVersion?.oauth.credentialProvider == 'manual'
        ) {
          try {
            let oauthSessionId = await authenticateWithOauth({
              serverDeploymentId: res.serverDeployments[0].id
            });

            await updateMagicMcpServer({
              magicMcpServerId: res.id,
              defaultOauthSessionId: oauthSessionId
            });
          } catch (e) {
            toast.error('OAuth authentication failed. Please try again.');
          }
        }

        navigate(Paths.magicMcpServer(res.id));
      }
    }
  });

  useEffect(() => {
    if (!server.data) return;
    form.setFieldValue('name', server.data.name);
  }, [server.data?.id]);

  useEffect(() => {
    if (serverConfigVaultId && currentStep == 1) setCurrentStep(2);
  }, [serverConfigVaultId, currentStep]);

  if (
    variants.data?.items.length === 0 &&
    (p.type == 'server_deployment.create' || p.type == 'magic_mcp_server.create')
  ) {
    return <Callout color="orange">This server cannot yet be deployed on Metorial.</Callout>;
  }

  if (loading) return <CenteredSpinner />;

  if (p.type == 'server_deployment.update' || p.type == 'magic_mcp_server.update') {
    return (
      <>
        <Box
          title={`${nameUpperCase} Settings`}
          description={`Modify the settings of this ${nameLowerCase}.`}
        >
          <Form onSubmit={form.handleSubmit}>
            <Input label="Name" {...form.getFieldProps('name')} />
            <form.RenderError field="name" />

            <Spacer size={15} />

            <Input label="Description" {...form.getFieldProps('description')} />
            <form.RenderError field="description" />

            <Spacer size={15} />

            <div
              style={{
                display: 'flex',
                gap: 10,
                justifyContent: 'flex-end'
              }}
            >
              {p.extraActions}

              {p.close && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={p.close}
                  disabled={updateMutator?.isLoading || createMutator.isLoading}
                >
                  Close
                </Button>
              )}

              <Button
                loading={updateMutator?.isLoading || createMutator.isLoading}
                success={updateMutator?.isSuccess || createMutator.isSuccess}
                type="submit"
              >
                Save
              </Button>
            </div>

            {updateMutator && <updateMutator.RenderError />}
          </Form>
        </Box>

        <Spacer size={20} />

        <Box
          title={`Delete ${nameUpperCase}`}
          description={`Permanently delete this ${nameLowerCase}. This action cannot be undone.`}
        >
          <Button
            color="red"
            onClick={() =>
              confirm({
                title: `Delete ${nameUpperCase}`,
                description: `Are you sure you want to delete this ${nameLowerCase}? This action cannot be undone.`,
                onConfirm: async () => {
                  if (!instance.data) return;

                  let [res] = await deleteMutator.mutate({});
                  if (res) {
                    toast.success(`${nameUpperCase} deleted successfully.`);
                    navigate(
                      resource == 'magic_mcp_server'
                        ? Paths.instance.magicMcp.servers(
                            instance.data?.organization,
                            instance.data?.project,
                            instance.data
                          )
                        : Paths.instance.serverDeployments(
                            instance.data?.organization,
                            instance.data?.project,
                            instance.data
                          )
                    );
                  }
                }
              })
            }
            disabled={updateResource.data?.status === 'archived'}
          >
            Delete
          </Button>
        </Box>
      </>
    );
  }

  return (
    <Form
      onSubmit={e => {
        if (currentStep < 2) {
          e.preventDefault();
          e.stopPropagation();
          setCurrentStep(currentStep + 1);
          return;
        }

        return form.handleSubmit(e);
      }}
    >
      <Stepper
        currentStep={currentStep}
        setCurrentStep={setCurrentStep}
        steps={[
          {
            title: 'Server',
            subtitle: 'Choose a server',
            render: () => {
              return (
                <ServerSearch
                  onSelect={server => {
                    setSearchServer(server as any);
                  }}
                />
              );
            }
          },

          {
            title: 'Configuration',
            subtitle: 'Set up the server',
            render: () => {
              if (!serverNeedsConfig)
                return <p>This server does not require any configuration.</p>;

              return (
                <JsonSchemaInput
                  label="Config"
                  schema={variant?.currentVersion?.schema ?? {}}
                  value={form.values.config}
                  onChange={v => form.setFieldValue('config', v)}
                  variant="raw"
                />
              );
            }
          },

          {
            title: 'Finish',
            subtitle: 'Review and deploy',
            render: () => {
              return (
                <>
                  <Input label="Name" {...form.getFieldProps('name')} autoFocus />
                  <form.RenderError field="name" />

                  <Spacer size={15} />

                  <Input label="Description" {...form.getFieldProps('description')} />
                  <form.RenderError field="description" />
                </>
              );
            }
          }
        ]}
      />

      {currentStep > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 10,
            justifyContent: 'flex-end',
            marginTop: 10
          }}
        >
          {p.extraActions}

          {p.close && (
            <Button
              type="button"
              variant="outline"
              onClick={p.close}
              disabled={updateMutator?.isLoading || createMutator.isLoading}
              size="2"
            >
              Close
            </Button>
          )}

          {currentStep == 1 ? (
            <Button
              type="button"
              size="2"
              onClick={e => {
                e.preventDefault();
                e.stopPropagation();
                setCurrentStep(2);
              }}
            >
              Continue
            </Button>
          ) : (
            <Button
              loading={updateMutator?.isLoading || createMutator.isLoading}
              success={updateMutator?.isSuccess || createMutator.isSuccess}
              type="submit"
              size="2"
            >
              Create
            </Button>
          )}
        </div>
      )}

      {!createMutator.error?.message.includes('OAuth configuration is required') && (
        <createMutator.RenderError />
      )}
    </Form>
  );
};

export type ServerDeploymentFormProps =
  | { type: 'update'; serverDeploymentId: string; for?: undefined }
  | {
      type: 'create';
      for?: For;
      serverConfigVaultId?: string;
    };

export let ServerDeploymentForm = (
  p: ServerDeploymentFormProps & {
    close?: () => any;
    extraActions?: React.ReactNode;
    onCreate?: (depl: ServersDeploymentsGetOutput) => any;
  }
) => (
  // @ts-ignore
  <ServerDeploymentFormInternal
    {...p}
    type={p.type == 'update' ? 'server_deployment.update' : 'server_deployment.create'}
  />
);
