import { CodeEditor } from '@metorial/code-editor';
import { useForm } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ServersListingsGetOutput } from '@metorial/generated/src/mt_2025_01_01_dashboard';
import {
  useCreateImplementation,
  useCurrentInstance,
  useServerImplementation,
  useServerVariants
} from '@metorial/state';
import { Button, Input, Spacer } from '@metorial/ui';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { ServerSearch } from '../servers/search';
import { Stepper } from '../stepper';

let Form = styled.form`
  display: flex;
  flex-direction: column;
`;

export type ServerImplementationFormProps =
  | { type: 'update'; serverImplementationId: string }
  | {
      type: 'create';
      for?:
        | { serverId: string }
        | { serverId: string; serverVariantId: string }
        | { serverId: string; serverVariantId: string; serverImplementationId: string };
    };

export let ServerImplementationForm = (
  p: ServerImplementationFormProps & { close?: () => any }
) => {
  let instance = useCurrentInstance();
  let implementation =
    p.type == 'update'
      ? useServerImplementation(instance.data?.id, p.serverImplementationId)
      : null;

  let update = implementation?.useUpdateMutator();
  let create = useCreateImplementation();

  let [currentStep, setCurrentStep] = useState(0);

  let navigate = useNavigate();

  let [searchServer, setSearchServer] = useState<ServersListingsGetOutput | undefined>(
    undefined
  );

  let variants = useServerVariants(
    instance.data?.id,
    p.type == 'create'
      ? (p.for?.serverId ?? searchServer?.server.id)
      : implementation?.data?.server.id
  );

  let variant = (p as any).for?.serverVariantId
    ? variants.data?.items.find(v => v.id == (p as any).for?.serverVariantId)
    : variants.data?.items[0];

  if (currentStep == 0 && variant) currentStep = 1;

  let form = useForm({
    initialValues: {
      name: implementation?.data?.name ?? implementation?.data?.server.name ?? '',
      description: implementation?.data?.description ?? '',
      metadata: implementation?.data?.metadata ?? {},
      getLaunchParams: implementation?.data?.getLaunchParams ?? ''
    },
    schema: yup =>
      yup.object({
        name: yup.string(),
        description: yup.string().optional(),
        metadata: yup.object().optional(),
        getLaunchParams: yup.string().optional()
      }),
    onSubmit: async values => {
      if (update) {
        await update.mutate({
          name: values.name || undefined,
          description: values.description || undefined,
          metadata: values.metadata,
          getLaunchParams:
            (values.getLaunchParams == variant?.currentVersion?.getLaunchParams
              ? undefined
              : values.getLaunchParams) || undefined
        });
      } else if (p.type == 'create') {
        let [res] = await create.mutate({
          name: values.name,
          description: values.description,
          metadata: values.metadata,
          getLaunchParams: values.getLaunchParams,
          instanceId: instance.data?.id!,
          serverId: p.for?.serverId ?? searchServer?.server.id!,
          ...p.for
        });

        if (res) {
          navigate(
            Paths.instance.serverImplementation(
              instance.data?.organization,
              instance.data?.project,
              instance.data,
              res.id
            )
          );
        }
      }
    }
  });

  useEffect(() => {
    if (variant?.currentVersion?.getLaunchParams && !form.values.getLaunchParams) {
      form.setFieldValue('getLaunchParams', variant.currentVersion.getLaunchParams);
    }
  }, [variant]);

  let edit = (
    <>
      <Input label="Name" {...form.getFieldProps('name')} />
      <form.RenderError field="name" />

      <Spacer size={15} />

      <Input label="Description" {...form.getFieldProps('description')} />
      <form.RenderError field="description" />

      <Spacer size={15} />

      <CodeEditor
        label="Get Launch Params"
        description="Get the parameters to start the server. In most cases, the default implementation works fine."
        height="300px"
        lang="javascript"
        value={form.values.getLaunchParams ?? ''}
        onChange={v => form.setFieldValue('getLaunchParams', v)}
      />
      <form.RenderError field="getLaunchParams" />

      <Spacer size={15} />

      <div
        style={{
          display: 'flex',
          gap: 10,
          justifyContent: 'flex-end'
        }}
      >
        {p.close && (
          <Button
            size="2"
            type="button"
            variant="outline"
            onClick={p.close}
            disabled={update?.isLoading || create.isLoading}
          >
            Close
          </Button>
        )}

        <Button
          size="2"
          loading={update?.isLoading || create.isLoading}
          success={update?.isSuccess || create.isSuccess}
          type="submit"
        >
          {p.type == 'update' ? 'Save' : 'Create'}
        </Button>
      </div>
    </>
  );

  if (p.type == 'update' || (p.type == 'create' && p.for)) {
    return (
      <Form onSubmit={form.handleSubmit}>
        {edit}

        {update && <update.RenderError />}
        <create.RenderError />
      </Form>
    );
  }

  return (
    <Form onSubmit={form.handleSubmit}>
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
                    setSearchServer(server);
                  }}
                />
              );
            }
          },

          {
            title: 'Configuration',
            subtitle: 'Set up the implementation',
            render: () => edit
          }
        ]}
      />

      {update && <update.RenderError />}
      <create.RenderError />
    </Form>
  );
};
