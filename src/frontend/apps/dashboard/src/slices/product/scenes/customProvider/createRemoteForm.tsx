import { CustomProvidersGetOutput } from '@metorial/dashboard-sdk';
import { useForm } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  listCustomProviderVersions,
  useCreateCustomProvider,
  useCurrentInstance
} from '@metorial/state';
import { Avatar, Button, Input, Or, Select, Spacer, theme, toast } from '@metorial/ui';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { Stepper } from '../../../../components/stepper';
import { remoteServerTemplates } from './config';
import {
  getCustomProviderRemoteProtocolFromUrl,
  waitForCustomProviderVersionId
} from './utils';

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

let Form = styled.div`
  display: flex;
  flex-direction: column;
`;

export let CustomProviderRemoteCreateForm = (p: {
  close?: () => any;
  onCreate?: (out: CustomProvidersGetOutput) => any;
}) => {
  let instance = useCurrentInstance();
  let createCustomProvider = useCreateCustomProvider();

  let [currentStep, setCurrentStep] = useState(0);
  let [hasManualRemoteProtocol, setHasManualRemoteProtocol] = useState(false);

  let navigate = useNavigate();

  let form = useForm({
    initialValues: {
      name: '',
      remoteUrl: '',
      description: '',
      metadata: {},
      remoteProtocol: getCustomProviderRemoteProtocolFromUrl('')
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

      let [customProviderRes] = await createCustomProvider.mutate({
        instanceId: instance.data.id,
        name: values.name,
        description: values.description,
        from: {
          type: 'remote',
          remoteUrl: values.remoteUrl.trim(),
          protocol: values.remoteProtocol == 'sse' ? 'sse' : 'streamable_http'
        }
      });

      if (customProviderRes) {
        let firstVersionId = await waitForCustomProviderVersionId(async () => {
          let [versionsRes] = await listCustomProviderVersions({
            limit: 1,
            instanceId: instance.data.id,
            customProviderId: customProviderRes.id
          });

          return versionsRes?.items[0]?.id;
        });

        toast.success('Provider linked successfully');

        if (p.onCreate) {
          p.onCreate(customProviderRes);
        } else {
          navigate(
            Paths.instance.customProvider(
              instance.data.organization,
              instance.data.project,
              instance.data,
              customProviderRes.id,
              ...(firstVersionId ? ['versions', { version_id: firstVersionId }] : [])
            ),
            {
              state: {
                category: 'external'
              }
            }
          );
        }
      }
    }
  });

  useEffect(() => {
    if (hasManualRemoteProtocol) return;

    let nextRemoteProtocol = getCustomProviderRemoteProtocolFromUrl(form.values.remoteUrl);
    if (form.values.remoteProtocol === nextRemoteProtocol) return;

    void form.setFieldValue('remoteProtocol', nextRemoteProtocol);
  }, [form.values.remoteProtocol, form.values.remoteUrl, hasManualRemoteProtocol]);

  let handleRemoteSetupSubmit = async () => {
    form.setFieldTouched('remoteUrl', true, false);
    form.setFieldTouched('remoteProtocol', true, false);

    let errors = await form.validateForm();
    if (errors.remoteUrl || errors.remoteProtocol) return;

    setCurrentStep(1);
  };

  let close = p.close && (
    <Button
      type="button"
      variant="outline"
      onClick={p.close}
      disabled={createCustomProvider.isLoading}
      size="2"
    >
      Close
    </Button>
  );

  return (
    <Form>
      <Stepper
        currentStep={currentStep}
        setCurrentStep={setCurrentStep}
        steps={[
          {
            title: 'Remote URL',
            subtitle: 'Enter the remote MCP server URL',
            render: () => {
              return (
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    void handleRemoteSetupSubmit();
                  }}
                >
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

                            let remoteProtocol = getCustomProviderRemoteProtocolFromUrl(
                              template.remoteUrl
                            );

                            setHasManualRemoteProtocol(false);
                            void form.setFieldValue('remoteUrl', template.remoteUrl);
                            void form.setFieldValue('remoteProtocol', remoteProtocol);
                            void form.setFieldValue('name', template.name);

                            setCurrentStep(1);
                          }}
                        >
                          <Avatar entity={template} size={24} imageFit="contain" />
                          <span>{template.name}</span>
                        </TemplatesItem>
                      ))}
                    </Templates>

                    <Actions>
                      {close}

                      <Button type="submit" size="2">
                        Continue
                      </Button>
                    </Actions>
                  </TemplateWrapper>
                </form>
              );
            }
          },

          {
            title: 'Finish',
            subtitle: 'Review and deploy',
            render: () => {
              return (
                <form onSubmit={form.handleSubmit}>
                  <Input label="Name" {...form.getFieldProps('name')} autoFocus />
                  <form.RenderError field="name" />

                  <Spacer size={15} />

                  <Input label="Description" {...form.getFieldProps('description')} />
                  <form.RenderError field="description" />

                  <Actions>
                    {close}

                    <Button
                      loading={createCustomProvider.isLoading}
                      success={createCustomProvider.isSuccess}
                      type="submit"
                      size="2"
                    >
                      Create
                    </Button>
                  </Actions>
                </form>
              );
            }
          }
        ]}
      />

      {createCustomProvider.error && <createCustomProvider.RenderError />}
    </Form>
  );
};
