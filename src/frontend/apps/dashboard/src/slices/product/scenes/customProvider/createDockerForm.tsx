import { CodeEditor } from '@metorial/code-editor';
import { CustomProvidersGetOutput } from '@metorial/dashboard-sdk';
import { useForm } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCreateCustomProvider, useCurrentInstance } from '@metorial/state';
import { Button, Input, Spacer, toast } from '@metorial/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { Stepper } from '../stepper';
import { getDefaultServerConfigDocker } from './config';

let Actions = styled.div`
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 10px;
`;

let Form = styled.div`
  display: flex;
  flex-direction: column;
`;

export let CustomProviderDockerCreateForm = (p: {
  close?: () => any;
  onCreate?: (out: CustomProvidersGetOutput) => any;
}) => {
  let instance = useCurrentInstance();
  let createCustomProvider = useCreateCustomProvider();

  let [currentStep, setCurrentStep] = useState(0);

  let navigate = useNavigate();

  let form = useForm({
    initialValues: {
      name: '',
      dockerImage: '',
      description: '',
      metadata: {},
      getLaunchParams: getDefaultServerConfigDocker.getLaunchParams
    },
    schema: yup =>
      yup.object({
        name: yup.string().required('Name is required'),
        dockerImage: yup.string().required('Docker Image URL is required'),
        getLaunchParams: yup.string().required('Launch Parameters are required'),
        description: yup.string().optional(),
        metadata: yup.object().optional()
      }),
    onSubmit: async values => {
      if (!instance.data) return;

      let [customProviderRes] = await createCustomProvider.mutate({
        instanceId: instance.data.id,
        name: values.name,
        description: values.description,
        from: {
          type: 'container',
          imageRef: values.dockerImage
        }
      });

      if (customProviderRes) {
        toast.success('Provider created successfully');

        if (p.onCreate) {
          p.onCreate(customProviderRes);
        } else {
          navigate(
            Paths.instance.customProvider(
              instance.data.organization,
              instance.data.project,
              instance.data,
              customProviderRes.id
            ),
            {
              state: {
                category: 'custom'
              }
            }
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
      disabled={createCustomProvider.isLoading}
      size="2"
    >
      Close
    </Button>
  );

  let handleDockerSetupSubmit = async () => {
    form.setFieldTouched('dockerImage', true, false);
    form.setFieldTouched('getLaunchParams', true, false);

    let errors = await form.validateForm();
    if (errors.dockerImage || errors.getLaunchParams) return;

    setCurrentStep(1);
  };

  return (
    <Form>
      <Stepper
        currentStep={currentStep}
        setCurrentStep={setCurrentStep}
        steps={[
          {
            title: 'Docker Image',
            subtitle: 'Enter the Docker image URL',
            render: () => {
              return (
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    void handleDockerSetupSubmit();
                  }}
                >
                  <Input
                    label="Docker Image"
                    description="The Docker image URL for your MCP provider"
                    placeholder="e.g. ghcr.io/metorial/mcp-server:latest"
                    {...form.getFieldProps('dockerImage')}
                  />
                  <form.RenderError field="dockerImage" />

                  <Spacer size={15} />

                  <CodeEditor
                    label="Start Command"
                    lang="javascript"
                    description="Define the environment variables and arguments for starting the Docker container."
                    value={form.values.getLaunchParams}
                    onChange={value => form.setFieldValue('getLaunchParams', value)}
                    height="200px"
                  />
                  <form.RenderError field="getLaunchParams" />

                  <Actions>
                    {close}

                    <Button type="submit" size="2">
                      Continue
                    </Button>
                  </Actions>
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
