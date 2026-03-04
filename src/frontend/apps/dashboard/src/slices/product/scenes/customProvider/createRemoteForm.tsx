import { CustomProvidersGetOutput } from '@metorial/dashboard-sdk';
import { useForm } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCreateCustomProvider, useCurrentInstance } from '@metorial/state';
import { Avatar, Button, Input, Or, Select, Spacer, theme, toast } from '@metorial/ui';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { Stepper } from '../stepper';
import { remoteServerTemplates } from './config';
import { getCustomServerRemoteProtocolFromUrl } from './utils';

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
  onCreate?: (out: CustomProvidersGetOutput) => any;
}) => {
  let instance = useCurrentInstance();
  let createCustomServer = useCreateCustomProvider();

  let [currentStep, setCurrentStep] = useState(0);
  let [hasManualRemoteProtocol, setHasManualRemoteProtocol] = useState(false);

  let navigate = useNavigate();

  let form = useForm({
    initialValues: {
      name: '',
      remoteUrl: '',
      description: '',
      metadata: {},
      remoteProtocol: getCustomServerRemoteProtocolFromUrl('')
    },
    schema: yup =>
      yup.object({
        name: yup.string().required('Name is required'),
        remoteUrl: yup.string().url().required('Remote URL is required'),
        description: yup.string().optional(),
        metadata: yup.object().optional(),
        remoteProtocol: yup.string().optional()
      }),
    onSubmit: async values => {
      if (!instance.data) return;

      let [customServerRes] = await createCustomServer.mutate({
        instanceId: instance.data.id,
        name: values.name,
        description: values.description,
        from: {
          type: 'remote',
          remoteUrl: values.remoteUrl.trim(),
          protocol: values.remoteProtocol == 'sse' ? 'sse' : 'streamable_http'
        }
      });

      if (customServerRes) {
        toast.success('Provider linked successfully');

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

  useEffect(() => {
    if (hasManualRemoteProtocol) return;

    let nextRemoteProtocol = getCustomServerRemoteProtocolFromUrl(form.values.remoteUrl);
    if (form.values.remoteProtocol === nextRemoteProtocol) return;

    void form.setFieldValue('remoteProtocol', nextRemoteProtocol);
  }, [form.values.remoteProtocol, form.values.remoteUrl, hasManualRemoteProtocol]);

  let close = p.close && (
    <Button
      type="button"
      variant="outline"
      onClick={p.close}
      disabled={createCustomServer.isLoading}
      size="2"
    >
      Close
    </Button>
  );

  let handleSubmit = async () => {
    await form.submitForm();
  };

  return (
    <Form
      onSubmit={e => {
        e.preventDefault();
        if (currentStep < 1) {
          setCurrentStep(currentStep + 1);
          return;
        }

        void handleSubmit();
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
                    description="Enter the MCP provider URL you want to connect to."
                    placeholder="https://mcp.monday.com/sse"
                    {...form.getFieldProps('remoteUrl')}
                  />
                  <form.RenderError field="remoteUrl" />

                  <Spacer size={15} />

                  <Select
                    value={form.values.remoteProtocol}
                    label="MCP Transport Protocol"
                    description="Which transport protocol does your MCP provider support?"
                    items={[
                      { label: 'SSE (Server-Sent Events)', id: 'sse' },
                      { label: 'Streamable HTTP', id: 'streamable_http' }
                    ]}
                    onChange={v => {
                      setHasManualRemoteProtocol(true);
                      void form.setFieldValue('remoteProtocol', v);
                    }}
                  />
                  <form.RenderError field="remoteProtocol" />

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

                          let remoteProtocol = getCustomServerRemoteProtocolFromUrl(
                            template.remoteUrl
                          );

                          setHasManualRemoteProtocol(false);
                          void form.setFieldValue('remoteUrl', template.remoteUrl);
                          void form.setFieldValue('remoteProtocol', remoteProtocol);
                          void form.setFieldValue('name', template.name);

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

                    <Button
                      type="button"
                      size="2"
                      disabled={!form.values.remoteUrl}
                      onClick={() => setCurrentStep(1)}
                    >
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
                      loading={createCustomServer.isLoading}
                      success={createCustomServer.isSuccess}
                      type="button"
                      onClick={handleSubmit}
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

      {createCustomServer.error && <createCustomServer.RenderError />}
    </Form>
  );
};
