import { CustomServersGetOutput } from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { useForm } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useAutoDiscoverProviderConnection,
  useCreateCustomServer,
  useCreateProviderConnection,
  useCurrentInstance
} from '@metorial/state';
import { Avatar, Button, Input, Or, Spacer, theme, toast } from '@metorial/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { Stepper } from '../stepper';
import { remoteServerTemplates } from './config';

let TemplateWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 5px;
`;

let Actions = styled.div`
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 10px;
`;

let Templates = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 10px;
`;

let TemplatesItem = styled.button`
  display: flex;
  align-items: center;
  padding: 10px;
  background: none;
  border: ${theme.colors.gray300} 1px solid;
  border-radius: 8px;
  text-align: left;
  gap: 10px;

  span {
    font-size: 14px;
    font-weight: 600;
    color: ${theme.colors.gray800};
  }
`;

let Form = styled.form`
  display: flex;
  flex-direction: column;
`;

export let CustomServerRemoteCreateForm = (p: {
  close?: () => any;
  onCreate?: (out: CustomServersGetOutput) => any;
}) => {
  let instance = useCurrentInstance();
  let autoDiscovery = useAutoDiscoverProviderConnection();
  let createProviderConnection = useCreateProviderConnection();
  let createCustomServer = useCreateCustomServer();

  let [currentStep, setCurrentStep] = useState(0);

  let navigate = useNavigate();

  let form = useForm({
    initialValues: {
      name: '',
      remoteUrl: '',
      description: '',
      metadata: {}
    },
    schema: yup =>
      yup.object({
        name: yup.string().required('Name is required'),
        remoteUrl: yup.string().url().required('Remote URL is required'),
        description: yup.string().optional(),
        metadata: yup.object().optional()
      }),
    onSubmit: async values => {
      if (!instance.data) return;

      let [discoverRes] = await autoDiscovery.mutate({
        discoveryUrl: values.remoteUrl,
        clientName: instance.data.organization.name
      });

      let providerConnectionId: string | undefined = undefined;

      if (discoverRes) {
        let [providerConnectionRes] = await createProviderConnection.mutate({
          name: values.name || undefined,
          description: values.description || undefined,
          discoveryUrl: values.remoteUrl || undefined,

          scopes: [],
          config: discoverRes.config,
          metadata: {},
          instanceId: instance.data.id,

          ...(discoverRes.autoRegistrationId
            ? {
                autoRegistrationId: discoverRes.autoRegistrationId
              }
            : {
                clientId: discoverRes.config.client_id,
                clientSecret: discoverRes.config.client_secret
              })
        });

        if (providerConnectionRes) {
          providerConnectionId = providerConnectionRes.id;
        }
      }

      let [customServerRes] = await createCustomServer.mutate({
        instanceId: instance.data.id,
        name: values.name,
        description: values.description,
        implementation: {
          type: 'remote_server',
          remoteServer: {
            remoteUrl: values.remoteUrl,
            connectionId: providerConnectionId
          },
          config: {
            schema: {
              type: 'object',
              properties: {}
            },
            getLaunchParams: `(config, ctx) => ({
  query: {},
  headers: ctx.getHeadersWithAuthorization({})
});`
          }
        }
      });

      if (customServerRes) {
        toast.success('Server linked successfully');

        if (p.onCreate) {
          p.onCreate(customServerRes);
        } else {
          navigate(
            Paths.instance.customServer(
              instance.data.organization,
              instance.data.project,
              instance.data,
              customServerRes.id
            )
          );
        }
      }
    }
  });

  let close = p.close && (
    <Button
      type="button"
      variant="outline"
      onClick={p.close}
      disabled={
        createCustomServer.isLoading ||
        createProviderConnection.isLoading ||
        autoDiscovery.isLoading
      }
      size="2"
    >
      Close
    </Button>
  );

  return (
    <Form
      onSubmit={e => {
        if (currentStep < 1) {
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
            title: 'Remote URL',
            subtitle: 'Enter the remote server URL',
            render: () => {
              return (
                <TemplateWrapper>
                  <Input
                    label="Remote URL"
                    description="Enter the MCP server URL you want to connect to."
                    placeholder="https://mcp.monday.com/sse"
                    {...form.getFieldProps('remoteUrl')}
                    autoFocus
                  />
                  <form.RenderError field="remoteUrl" />

                  <Spacer size={10} />

                  <Or text="Or" />

                  <Spacer size={10} />

                  <Templates>
                    {remoteServerTemplates.map(template => (
                      <TemplatesItem
                        key={template.remoteUrl}
                        type="button"
                        onClick={() => {
                          form.resetForm();

                          form.setFieldValue('remoteUrl', template.remoteUrl);
                          form.setFieldValue('name', template.name);

                          setCurrentStep(1);
                        }}
                      >
                        <Avatar entity={template} size={24} />
                        <span>{template.name}</span>
                      </TemplatesItem>
                    ))}
                  </Templates>

                  <Actions>
                    {close}

                    <Button type="button" size="2" disabled={!form.values.remoteUrl}>
                      Continue
                    </Button>
                  </Actions>
                </TemplateWrapper>
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

                  <Actions>
                    {close}

                    <Button
                      loading={
                        createCustomServer.isLoading ||
                        createProviderConnection.isLoading ||
                        autoDiscovery.isLoading
                      }
                      success={
                        createCustomServer.isSuccess &&
                        createProviderConnection.isSuccess &&
                        autoDiscovery.isSuccess
                      }
                      type="submit"
                      size="2"
                    >
                      Create
                    </Button>
                  </Actions>
                </>
              );
            }
          }
        ]}
      />

      {createProviderConnection.error && <createProviderConnection.RenderError />}
      {createCustomServer.error && <createCustomServer.RenderError />}
      {autoDiscovery.error && <autoDiscovery.RenderError />}
    </Form>
  );
};
