import {
  MagicMcpServersGetOutput,
  ServersListingsGetOutput
} from '@metorial/consumer-sdk/src/gen/src/mt_2025_01_01_pulsar';
import { useForm } from '@metorial/data-hooks';
import {
  AccordionSingle,
  Button,
  Callout,
  CenteredSpinner,
  confirm,
  Copy,
  Dialog,
  Input,
  showModal,
  Spacer,
  toast
} from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useServerListing } from '../../../state/consumer/listings';
import {
  useCreateMagicMcpServer,
  useMagicMcpServer
} from '../../../state/consumer/magicMcpServer';
import { useServerVariants } from '../../../state/consumer/serverVariants';
import { useServer } from '../../../state/consumer/servers';

let Form = styled.form`
  display: flex;
  flex-direction: column;
`;

type For =
  | { serverId: string }
  | { serverId: string; serverVariantId: string }
  | { serverId: string; serverVariantId: string; serverImplementationId: string };

export type ServerDeploymentFormPropsInternal =
  | { type: 'magic_mcp_server.update'; magicMcpServerId: string; for?: undefined }
  | {
      type: 'magic_mcp_server.create';
      for?: For;
    };

let ServerDeploymentFormInternal = (
  p: ServerDeploymentFormPropsInternal & {
    close?: () => any;
    extraActions?: React.ReactNode;
    onCreate?: (depl: MagicMcpServersGetOutput) => any;
  }
) => {
  let navigate = useNavigate();

  let magicMcpServer = useMagicMcpServer(
    p.type == 'magic_mcp_server.update' ? p.magicMcpServerId : undefined
  );

  let [currentStep, setCurrentStep] = useState(0);
  let [searchServer, setSearchServer] = useState<ServersListingsGetOutput | undefined>(
    undefined
  );
  let serverId =
    p.for?.serverId ?? searchServer?.server.id ?? magicMcpServer.data?.serverDeployments[0].id;

  let createMutator = useCreateMagicMcpServer();

  if (serverId && currentStep == 0) currentStep = 1;

  let listing = useServerListing(serverId);
  let variants = useServerVariants(serverId);
  let server = useServer(serverId);

  let variant = (p as any).for?.serverVariantId
    ? variants.data?.items.find(v => v.id == (p as any).for?.serverVariantId)
    : variants.data?.items[0];

  let serverNeedsConfig =
    variant?.currentVersion?.schema &&
    Object.entries(variant?.currentVersion?.schema?.properties ?? {}).length > 0;

  if (!serverNeedsConfig && currentStep == 1) currentStep = 2;

  let isUpdate = p.type == 'magic_mcp_server.update';
  let loading = (isUpdate && magicMcpServer.isLoading) || (serverId && variants.isLoading);

  let nameUpperCase = 'Magic MCP Server';
  let nameLowerCase = nameUpperCase.toLowerCase();

  let form = useForm({
    initialValues: {
      name: magicMcpServer.data?.name ?? '',
      description: magicMcpServer.data?.description ?? '',
      metadata: magicMcpServer.data?.metadata ?? {}
    },
    schema: yup =>
      yup.object({
        name: yup.string(),
        description: yup.string().optional(),
        metadata: yup.object().optional(),
        config: yup.object()
      }),
    onSubmit: async values => {
      if (p.type == 'magic_mcp_server.update') {
        throw new Error('TODO: Not implemented yet');

        // await updateMutator.mutate({
        //   name: values.name,
        //   description: values.description,
        //   metadata: values.metadata,
        //   config: configChanged ? values.config : undefined
        // });
        // serverDeployment?.refetch();
      } else if (p.type == 'magic_mcp_server.create') {
        let doCreate = async (
          oauthConfig: { clientId: string; clientSecret: string } | undefined
        ) => {
          let [res, err] = await createMutator.mutate({
            name: values.name,
            description: values.description,
            metadata: values.metadata,
            config: serverConfigVaultId ? undefined! : values.config,
            serverConfigVaultId: serverConfigVaultId!,
            instanceId: instance.data?.id!,
            serverId: p.for?.serverId ?? searchServer?.server.id!,
            oauthConfig,
            ...p.for
          });

          if (err?.message.includes('OAuth configuration is required')) {
            showModal(({ dialogProps, close }) => {
              let form = useForm({
                initialValues: {
                  clientId: '',
                  clientSecret: ''
                },
                schema: yup =>
                  yup.object({
                    clientId: yup.string().required('Client ID is required'),
                    clientSecret: yup.string().required('Client Secret is required')
                  }),
                onSubmit: async values => {
                  doCreate({
                    clientId: values.clientId,
                    clientSecret: values.clientSecret
                  });
                  close();
                }
              });

              let rootDomain = document.location.hostname.split('.').slice(-2).join('.');
              return (
                <Dialog.Wrapper {...dialogProps}>
                  <Dialog.Title>OAuth Configuration Required</Dialog.Title>

                  <Dialog.Description>
                    Please provide an OAuth Client ID and Client Secret to proceed with the
                    {nameLowerCase}.
                  </Dialog.Description>

                  {listing.data?.oauthExplainer && (
                    <>
                      <AccordionSingle title="OAuth Setup Instructions">
                        <Markdown>{listing.data?.oauthExplainer}</Markdown>
                      </AccordionSingle>
                      <Spacer size={10} />
                    </>
                  )}

                  <Copy
                    label="Redirect URL"
                    value={`https://provider-auth.${rootDomain}/provider-oauth/callback`}
                  />
                  <Spacer size={15} />

                  <Form onSubmit={form.handleSubmit}>
                    <Input
                      label="Client ID"
                      placeholder="Enter your OAuth Client ID"
                      {...form.getFieldProps('clientId')}
                      autoFocus
                    />
                    <form.RenderError field="clientId" />
                    <Spacer size={15} />

                    <Input
                      label="Client Secret"
                      placeholder="Enter your OAuth Client Secret"
                      type="password"
                      {...form.getFieldProps('clientSecret')}
                    />
                    <form.RenderError field="clientSecret" />
                    <Spacer size={15} />

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                      <Button type="submit" loading={form.isSubmitting}>
                        Submit
                      </Button>
                    </div>
                  </Form>
                </Dialog.Wrapper>
              );
            });
          }

          if (res) {
            if ('needsDefaultOauthSession' in res && res.needsDefaultOauthSession) {
              try {
                let oauthSessionId = await authenticateWithOauth({
                  instanceId: instance.data?.id!,
                  serverDeploymentId: res.serverDeployments[0].id
                });

                await updateMagicMcpServer({
                  instanceId: instance.data?.id!,
                  magicMcpServerId: res.id,
                  defaultOauthSessionId: oauthSessionId
                });
              } catch (e) {
                toast.error('OAuth authentication failed. Please try again.');
              }
            }

            if (p.onCreate) {
              p.onCreate(res);
              p.close?.();
            } else {
              navigate(
                resource == 'magic_mcp_server'
                  ? Paths.instance.magicMcp.server(
                      instance.data?.organization,
                      instance.data?.project,
                      instance.data,
                      res.id
                    )
                  : Paths.instance.serverDeployment(
                      instance.data?.organization,
                      instance.data?.project,
                      instance.data,
                      res.id
                    )
              );
            }
          }
        };

        doCreate(undefined);
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
            disabled={magicMcpServerdata?.status === 'archived'}
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

export type MagicMcpServerFormProps =
  | { type: 'update'; magicMcpServerId: string; for?: undefined }
  | {
      type: 'create';
      for?: For;
    };

export let MagicMcpServerForm = (
  p: MagicMcpServerFormProps & {
    close?: () => any;
    extraActions?: React.ReactNode;
    onCreate?: (depl: MagicMcpServersGetOutput) => any;
  }
) => (
  // @ts-ignore
  <ServerDeploymentFormInternal
    {...p}
    type={p.type == 'update' ? 'magic_mcp_server.update' : 'magic_mcp_server.create'}
  />
);
