import { CodeEditor } from '@metorial/code-editor';
import { CustomProvidersGetOutput } from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { useForm } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCreateCustomServer,
  useCurrentInstance,
  useListServerVersions
} from '@metorial/state';
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

let Form = styled.form`
  display: flex;
  flex-direction: column;
`;

export let CustomServerDockerCreateForm = (p: {
  close?: () => any;
  onCreate?: (out: CustomProvidersGetOutput) => any;
}) => {
  let instance = useCurrentInstance();
  let createCustomServer = useCreateCustomServer();
  let listServerVersions = useListServerVersions();

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

      let [customServerRes] = await createCustomServer.mutate({
        instanceId: instance.data.id,
        name: values.name,
        description: values.description,
        from: {
          type: 'container',
          imageRef: values.dockerImage
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

        toast.success('Provider created successfully');

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
            title: 'Docker Image',
            subtitle: 'Enter the Docker image URL',
            render: () => {
              return (
                <>
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

                    <Button
                      type="button"
                      size="2"
                      disabled={!form.values.dockerImage || !form.values.getLaunchParams}
                      onClick={() => setCurrentStep(1)}
                    >
                      Continue
                    </Button>
                  </Actions>
                </>
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
