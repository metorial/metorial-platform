import { CustomServersGetOutput } from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { renderWithLoader, useForm } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCreateCustomServer,
  useCreateScmInstallation,
  useCurrentInstance,
  useListServerVersions,
  useManagedServerTemplates,
  useScmInstallations
} from '@metorial/state';
import { Button, Input, Or, Spacer, theme, toast } from '@metorial/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { openWindow } from '../../../../lib/openWindows';
import { Stepper } from '../stepper';
import { defaultServerConfigManaged } from './config';

let PageWrapper = styled.div`
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
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
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

export let CustomServerManagedCreateForm = (p: {
  close?: () => any;
  onCreate?: (out: CustomServersGetOutput) => any;
}) => {
  let instance = useCurrentInstance();
  let createCustomServer = useCreateCustomServer();
  let listServerVersions = useListServerVersions();
  let managedServerTemplates = useManagedServerTemplates({
    limit: 100
  });
  let installations = useScmInstallations(instance.data?.organization.id);
  let createInstallation = useCreateScmInstallation();

  let [currentStep, setCurrentStep] = useState(0);

  let navigate = useNavigate();
  let [templateId, setTemplateId] = useState<string | undefined>(undefined);

  let form = useForm({
    initialValues: {
      name: '',
      description: '',
      metadata: {}
    },
    schema: yup =>
      yup.object({
        name: yup.string().required('Name is required'),
        description: yup.string().optional(),
        metadata: yup.object().optional()
      }),
    onSubmit: async values => {
      if (!instance.data) return;

      let plainTemplate = managedServerTemplates.data?.items.find(
        t => t.slug == 'plain-typescript'
      );

      let [customServerRes] = await createCustomServer.mutate({
        instanceId: instance.data.id,
        name: values.name,
        description: values.description,
        implementation: {
          type: 'managed',
          managedServer: {
            templateId: templateId ?? plainTemplate?.id
          },
          config: defaultServerConfigManaged
        }
      });

      if (customServerRes) {
        let firstVersionId: string | undefined = undefined;

        for (let i = 0; i < 5; i++) {
          let [versionsRes] = await listServerVersions.mutate({
            limit: 1,
            instanceId: instance.data.id,
            customServerId: customServerRes.id
          });
          if (versionsRes && versionsRes.items.length > 0) {
            firstVersionId = versionsRes?.items[0]?.id;
            break;
          }
        }

        toast.success('Server created successfully');

        if (p.onCreate) {
          p.onCreate(customServerRes);
        } else {
          navigate(
            Paths.instance.customServer(
              instance.data.organization,
              instance.data.project,
              instance.data,
              customServerRes.id,
              ...(firstVersionId ? ['versions', { version_id: firstVersionId }] : [])
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
      disabled={createCustomServer.isLoading}
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
            title: 'Choose Template',
            subtitle: 'Choose a template for your MCP server',
            render: () => {
              return renderWithLoader({ managedServerTemplates })(
                ({ managedServerTemplates }) => (
                  <PageWrapper>
                    <Button
                      onClick={async () => {
                        let [res] = await createInstallation.mutate({
                          organizationId: instance.data?.organization.id!,
                          provider: 'github',
                          redirectUrl: window.location.href
                        });

                        let toastShownRef = { current: false };

                        if (res) {
                          openWindow(res?.authorizationUrl!).onMessage(msg => {
                            if (msg.data.type === 'scm_complete') {
                              installations.refetch();

                              if (!toastShownRef.current) {
                                toast.success('GitHub connected successfully');
                                toastShownRef.current = true;
                              }
                            }
                          });
                        }
                      }}
                      size="3"
                      fullWidth
                      type="button"
                    >
                      Connect GitHub
                    </Button>

                    <Spacer size={10} />

                    <Or />

                    <Spacer size={10} />

                    <Templates>
                      {managedServerTemplates.data.items.map(template => (
                        <TemplatesItem
                          key={template.id}
                          type="button"
                          onClick={() => {
                            form.resetForm();
                            form.setFieldValue('name', template.name);
                            setTemplateId(template.id);
                            setCurrentStep(1);
                          }}
                        >
                          <span>{template.name}</span>
                        </TemplatesItem>
                      ))}
                    </Templates>

                    <Actions>
                      {close}

                      <Button
                        type="button"
                        size="2"
                        onClick={() => {
                          setTemplateId(undefined);
                          setCurrentStep(1);
                        }}
                      >
                        Continue without template
                      </Button>
                    </Actions>
                  </PageWrapper>
                )
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

      {createCustomServer.error && <createCustomServer.RenderError />}
    </Form>
  );
};
