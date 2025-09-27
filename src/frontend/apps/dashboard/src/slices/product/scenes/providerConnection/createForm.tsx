import { CodeEditor } from '@metorial/code-editor';
import { ProviderOauthConnectionsGetOutput } from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { useForm } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useAutoDiscoverProviderConnection,
  useCreateProviderConnection,
  useCurrentInstance,
  useEvaluateProviderConnectionTemplate,
  useProviderConnectionTemplates
} from '@metorial/state';
import {
  Avatar,
  Button,
  Callout,
  CenteredSpinner,
  Input,
  InputLabel,
  Or,
  SortableCheckList,
  Spacer,
  TextArrayInput,
  theme,
  toast
} from '@metorial/ui';
import { Fragment, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { remoteServerTemplates } from '../customServer/config';
import { Stepper } from '../stepper';
import { getDefaultOAuthConfig, parseConfig } from './config';

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

export let ProviderConnectionCreateForm = (p: {
  close?: () => any;
  onCreate?: (out: ProviderOauthConnectionsGetOutput) => any;
  setModalSize?: (size: 'default' | 'large') => any;
}) => {
  let instance = useCurrentInstance();
  let create = useCreateProviderConnection();

  let [currentStep, setCurrentStep] = useState(0);

  let navigate = useNavigate();

  let evaluate = useEvaluateProviderConnectionTemplate();

  let templates = useProviderConnectionTemplates({ limit: 100 });
  let [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>(undefined);
  let [providerUrl, setProviderUrl] = useState<string | undefined>(undefined);
  let [templateData, setTemplateData] = useState<Record<string, any>>(() => ({}));

  useEffect(() => {
    if (currentStep == 1 && providerUrl) {
      p.setModalSize?.('large');
    } else {
      p.setModalSize?.('default');
    }
  }, [currentStep, providerUrl]);

  let autoDiscovery = useAutoDiscoverProviderConnection();
  let [autoRegistrationId, setAutoRegistrationId] = useState<string | undefined>(undefined);

  let selectedTemplate = templates.data?.items.find(
    template => template.id === selectedTemplateId
  );

  let loading = templates.isLoading;

  let form = useForm({
    initialValues: {
      name: '',
      description: '',
      discoveryUrl: '',
      clientId: '',
      clientSecret: '',
      scopes: [],
      metadata: {},
      config: '{}'
    },
    schema: yup =>
      yup.object({
        name: yup.string(),
        description: yup.string().optional(),
        discoveryUrl: yup.string().optional(),
        clientId: yup.string().required('Client ID is required'),
        clientSecret: yup.string().required('Client ID is required'),
        scopes: yup.array(yup.string()).required('Scopes are required'),
        config: yup
          .string()
          .required('Configuration is required')
          .test('is-json', 'Configuration must be valid JSON', value => {
            try {
              parseConfig(value);
              return true;
            } catch {
              return false;
            }
          }),
        metadata: yup.object().optional()
      }),
    onSubmit: async values => {
      if (!instance.data) return;

      let config: any = {};
      try {
        config = parseConfig(values.config);
      } catch (e) {
        return toast.error('Invalid configuration format. Please check your JSON.');
      }

      let [res] = await create.mutate({
        name: values.name || undefined,
        description: values.description || undefined,
        discoveryUrl: values.discoveryUrl || undefined,
        templateId: selectedTemplateId || undefined,

        scopes: values.scopes.filter(s => s && s.trim()) as string[],
        config,
        metadata: values.metadata || {},
        instanceId: instance.data.id,

        ...(autoRegistrationId
          ? {
              autoRegistrationId: autoRegistrationId
            }
          : {
              clientId: values.clientId,
              clientSecret: values.clientSecret
            })
      });

      if (res) {
        toast.success('Provider connection created successfully.');

        if (p.onCreate) {
          p.close?.();
          p.onCreate(res);
        } else {
          navigate(
            Paths.instance.providerConnection(
              instance.data.organization,
              instance.data.project,
              instance.data,
              res.id
            )
          );
        }
      }
    }
  });

  if (loading) return <CenteredSpinner />;

  let close = p.close && (
    <Button
      type="button"
      variant="outline"
      onClick={p.close}
      disabled={create.isLoading}
      size="2"
    >
      Close
    </Button>
  );

  let performAutoDiscovery = async (providerInput?: string) => {
    if (providerInput) providerUrl = providerInput;

    if (!providerUrl || !instance.data) return;

    try {
      new URL(providerUrl);
    } catch (e) {
      toast.error('Invalid URL format. Please enter a valid URL.');
      return;
    }

    let [res] = await autoDiscovery.mutate({
      discoveryUrl: providerUrl,
      clientName: instance.data.organization.name
    });

    form.resetForm();

    if (res) {
      setAutoRegistrationId(undefined);
      form.setFieldValue('discoveryUrl', providerUrl);
      form.setFieldValue('config', JSON.stringify(res.config, null, 2));
      form.setFieldValue('name', res.providerName);

      if (res.autoRegistrationId) {
        setAutoRegistrationId(res.autoRegistrationId);
        form.setFieldValue('clientId', 'empty');
        form.setFieldValue('clientSecret', 'empty');
      } else if (res.config.client_id && res.config.client_secret) {
        form.setFieldValue('clientId', res.config.client_id);
        form.setFieldValue('clientSecret', res.config.client_secret);
      }
    } else {
      form.setFieldValue('config', getDefaultOAuthConfig({ providerUrl }));

      try {
        let url = new URL(providerUrl);
        form.setFieldValue('name', url.hostname);
      } catch {}
    }

    setCurrentStep(1);
  };

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
            title: 'Provider',
            subtitle: 'Select a provider',
            render: () => {
              return (
                <TemplateWrapper>
                  <Input
                    label="Provider URL"
                    description="Enter the authentication URL of the provider."
                    placeholder="https://accounts.google.com"
                    value={providerUrl ?? ''}
                    type="url"
                    onChange={e => {
                      setProviderUrl(e.target.value);
                      setSelectedTemplateId(undefined);
                      setAutoRegistrationId(undefined);
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        e.stopPropagation();
                        performAutoDiscovery();
                      }
                    }}
                  />
                  <form.RenderError field="discoveryUrl" />

                  <Spacer size={10} />

                  <Or text="Or" />

                  <Spacer size={10} />

                  <Templates>
                    {templates.data?.items.map(template => (
                      <TemplatesItem
                        key={template.id}
                        type="button"
                        onClick={() => {
                          setSelectedTemplateId(template.id);
                          setProviderUrl(undefined);
                          setCurrentStep(1);
                          setAutoRegistrationId(undefined);

                          form.resetForm();
                        }}
                        disabled={autoDiscovery.isLoading}
                      >
                        <Avatar entity={template.provider} size={24} />
                        <span>{template.name}</span>
                      </TemplatesItem>
                    ))}

                    {remoteServerTemplates
                      .filter(t => t.type == 'oauth')
                      .slice(0, 13)
                      .map(template => (
                        <TemplatesItem
                          key={template.remoteUrl}
                          type="button"
                          onClick={() => {
                            setSelectedTemplateId(undefined);
                            setProviderUrl(template.remoteUrl);
                            setAutoRegistrationId(undefined);
                            performAutoDiscovery(template.remoteUrl);
                            form.setFieldValue('name', template.name);
                          }}
                          disabled={autoDiscovery.isLoading}
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
                      loading={autoDiscovery.isLoading}
                      disabled={!providerUrl}
                      onClick={() => performAutoDiscovery()}
                    >
                      Continue
                    </Button>
                  </Actions>
                </TemplateWrapper>
              );
            }
          },

          {
            title: 'Configuration',
            subtitle: 'Configure the connection',
            render: () => {
              if (selectedTemplate) {
                return (
                  <>
                    <Input
                      label="Client ID"
                      description={`Create a new OAuth application for ${selectedTemplate.provider.name} to get your Client ID and Client Secret.`}
                      {...form.getFieldProps('clientId')}
                      autoFocus
                    />
                    <form.RenderError field="clientId" />

                    <Spacer size={15} />

                    <Input
                      label="Client Secret"
                      type="password"
                      {...form.getFieldProps('clientSecret')}
                    />
                    <form.RenderError field="clientSecret" />

                    <Spacer size={15} />

                    <InputLabel>OAuth Scopes</InputLabel>
                    <div
                      style={{
                        maxHeight: 200,
                        overflowY: 'auto',
                        border: `1px solid ${theme.colors.gray300}`,
                        padding: 10,
                        borderRadius: 10,
                        marginTop: 4
                      }}
                    >
                      <SortableCheckList
                        items={selectedTemplate.scopes.map(scope => ({
                          id: scope.id,
                          label: scope.identifier,
                          isChecked: form.values.scopes.includes(scope.id)
                        }))}
                        onChange={items => {
                          form.setFieldValue(
                            'scopes',
                            items.filter(item => item.isChecked).map(item => item.id)
                          );
                        }}
                      />
                    </div>

                    {selectedTemplate.variables.map(v => (
                      <Fragment key={v.id}>
                        <Spacer size={15} />

                        <Input
                          label={v.label}
                          description={v.description}
                          value={templateData?.[v.id] || ''}
                          onChange={e => {
                            setTemplateData(v => ({
                              ...v,
                              [v.id]: e.target.value
                            }));
                          }}
                        />
                      </Fragment>
                    ))}

                    <Actions>
                      {close}

                      <Button
                        type="button"
                        size="2"
                        loading={evaluate.isLoading}
                        disabled={!form.values.clientId || !form.values.clientSecret}
                        onClick={async e => {
                          let [res] = await evaluate.mutate({
                            providerConnectionTemplateId: selectedTemplate.id,
                            data: templateData
                          });
                          if (res) {
                            form.setFieldValue('config', JSON.stringify(res.config, null, 2));
                            form.setFieldValue('name', selectedTemplate.provider.name);
                            setCurrentStep(2);
                          }
                        }}
                      >
                        Continue
                      </Button>
                    </Actions>

                    <evaluate.RenderError />
                  </>
                );
              }

              if (providerUrl) {
                return (
                  <>
                    {!autoRegistrationId ? (
                      <>
                        <Input
                          label="Client ID"
                          description="Create a new OAuth application for the provider to get your Client ID and Client Secret."
                          {...form.getFieldProps('clientId')}
                          autoFocus
                        />
                        <form.RenderError field="clientId" />

                        <Spacer size={15} />

                        <Input
                          label="Client Secret"
                          type="password"
                          {...form.getFieldProps('clientSecret')}
                        />
                        <form.RenderError field="clientSecret" />

                        <Spacer size={15} />
                      </>
                    ) : (
                      <>
                        <Callout color="blue">
                          Metorial has auto-discovered the configuration for this provider. The
                          OAuth application will be automatically registered when you create
                          the connection.
                        </Callout>
                        <Spacer height={15} />
                      </>
                    )}

                    <TextArrayInput
                      label="Scopes"
                      description="Enter the required OAuth scopes for the connection."
                      value={form.values.scopes.map(s => s ?? '')}
                      onChange={v => form.setFieldValue('scopes', v)}
                      placeholder="e.g. read:user, write:posts"
                    />
                    <form.RenderError field="scopes" />

                    <Spacer size={15} />

                    <InputLabel>Configuration</InputLabel>
                    <Spacer size={6} />
                    <CodeEditor
                      value={form.values.config}
                      onChange={v => form.setFieldValue('config', v)}
                      onBlur={() => {
                        form.validateField('config');
                        form.setFieldTouched('config', true);
                      }}
                      lang="json"
                      height="350px"
                    />
                    <form.RenderError field="config" />

                    <Actions>
                      {close}

                      <Button
                        type="button"
                        size="2"
                        disabled={
                          !form.values.clientId ||
                          !form.values.clientSecret ||
                          !form.values.config
                        }
                        onClick={async e => {
                          setCurrentStep(2);
                        }}
                      >
                        Continue
                      </Button>
                    </Actions>
                  </>
                );
              }
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
                      loading={create.isLoading}
                      success={create.isSuccess}
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

      <create.RenderError />
    </Form>
  );
};
