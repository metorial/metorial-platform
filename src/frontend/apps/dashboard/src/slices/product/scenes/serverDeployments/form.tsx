import { canonicalize } from '@metorial/canonicalize';
import { ServersDeploymentsGetOutput } from '@metorial/core';
import { ServersListingsGetOutput } from '@metorial/core/src/mt_2025_01_01_dashboard';
import { useForm } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCreateDeployment,
  useCurrentInstance,
  useServerDeployment,
  useServerVariants
} from '@metorial/state';
import { Button, Input, Spacer } from '@metorial/ui';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { JsonSchemaEditor } from '../jsonSchemaEditor/jsonSchemaEditor';
import { ServerSearchField } from '../servers/search';

let Form = styled.form`
  display: flex;
  flex-direction: column;
`;

export type ServerDeploymentFormProps =
  | { type: 'update'; serverDeploymentId: string }
  | {
      type: 'create';
      for?:
        | { serverId: string }
        | { serverId: string; serverVariantId: string }
        | { serverId: string; serverVariantId: string; serverImplementationId: string };
    };

export let ServerDeploymentForm = (
  p: ServerDeploymentFormProps & {
    close?: () => any;
    extraActions?: React.ReactNode;
    onCreate?: (depl: ServersDeploymentsGetOutput) => any;
  }
) => {
  let instance = useCurrentInstance();
  let deployment =
    p.type == 'update' ? useServerDeployment(instance.data?.id, p.serverDeploymentId) : null;

  let update = deployment?.useUpdateMutator();
  let create = useCreateDeployment();

  let navigate = useNavigate();

  let [searchServer, setSearchServer] = useState<ServersListingsGetOutput | undefined>(
    undefined
  );

  let variants = useServerVariants(
    instance.data?.id,
    p.type == 'create'
      ? (p.for?.serverId ?? searchServer?.server.id)
      : deployment?.data?.server.id
  );

  let variant = (p as any).for?.serverVariantId
    ? variants.data?.items.find(v => v.id == (p as any).for?.serverVariantId)
    : variants.data?.items[0];

  let form = useForm({
    initialValues: {
      name: deployment?.data?.name ?? '',
      description: deployment?.data?.description ?? '',
      metadata: deployment?.data?.metadata ?? {},
      config: deployment?.data?.config ?? {}
    },
    schema: yup =>
      yup.object({
        name: yup.string().required('Name is required'),
        description: yup.string().optional(),
        metadata: yup.object().optional(),
        config: yup.object()
      }),
    onSubmit: async values => {
      if (update) {
        let configChanged =
          canonicalize(values.config) !== canonicalize(deployment?.data?.config);

        await update.mutate({
          name: values.name,
          description: values.description,
          metadata: values.metadata,
          config: configChanged ? values.config : undefined
        });
      } else if (p.type == 'create') {
        let [res] = await create.mutate({
          name: values.name,
          description: values.description,
          metadata: values.metadata,
          config: values.config,
          instanceId: instance.data?.id!,
          serverId: p.for?.serverId ?? searchServer?.server.id!,
          ...p.for
        });

        if (res) {
          if (p.onCreate) {
            p.onCreate(res);
            p.close?.();
          } else {
            navigate(
              Paths.instance.serverDeployment(
                instance.data?.organization,
                instance.data?.project,
                instance.data,
                res.id
              )
            );
          }
        }
      }
    }
  });

  return (
    <Form onSubmit={form.handleSubmit}>
      {p.type == 'create' && !p.for && (
        <>
          <ServerSearchField value={searchServer} onChange={setSearchServer} label="Server" />
          <Spacer size={15} />
        </>
      )}

      <Input label="Name" {...form.getFieldProps('name')} />
      <form.RenderError field="name" />

      <Spacer size={15} />

      <Input label="Description" {...form.getFieldProps('description')} />
      <form.RenderError field="description" />

      {variant?.currentVersion?.schema.schema && p.type == 'create' && (
        <>
          <Spacer size={15} />

          <JsonSchemaEditor
            label="Config"
            schema={variant?.currentVersion?.schema.schema ?? {}}
            value={form.values.config}
            onChange={v => form.setFieldValue('config', v)}
          />
        </>
      )}

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
            disabled={update?.isLoading || create.isLoading}
          >
            Close
          </Button>
        )}

        <Button
          loading={update?.isLoading || create.isLoading}
          success={update?.isSuccess || create.isSuccess}
          type="submit"
        >
          {p.type == 'update' ? 'Save' : 'Create'}
        </Button>
      </div>

      {update && <update.RenderError />}
      <create.RenderError />
    </Form>
  );
};
