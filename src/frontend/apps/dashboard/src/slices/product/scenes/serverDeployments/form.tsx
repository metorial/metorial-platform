import { canonicalize } from '@metorial/canonicalize';
import {
  ServersDeploymentsGetOutput,
  ServersListingsGetOutput
} from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { useForm } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCreateDeployment,
  useCurrentInstance,
  useServerDeployment,
  useServerVariants
} from '@metorial/state';
import { Button, Callout, CenteredSpinner, Input, Spacer } from '@metorial/ui';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { JsonSchemaInput } from '../jsonSchemaInput';
import { ServerSearch } from '../servers/search';
import { Stepper } from '../stepper';

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
  let deployment = useServerDeployment(
    instance.data?.id,
    p.type == 'update' ? p.serverDeploymentId : undefined
  );

  let update = deployment?.useUpdateMutator();
  let create = useCreateDeployment();

  let [currentStep, setCurrentStep] = useState(0);

  let navigate = useNavigate();

  let [searchServer, setSearchServer] = useState<ServersListingsGetOutput | undefined>(
    undefined
  );

  let serverId =
    p.type == 'create'
      ? (p.for?.serverId ?? searchServer?.server.id)
      : deployment?.data?.server.id;

  if (serverId && currentStep == 0) currentStep = 1;

  let variants = useServerVariants(instance.data?.id, serverId);

  let variant = (p as any).for?.serverVariantId
    ? variants.data?.items.find(v => v.id == (p as any).for?.serverVariantId)
    : variants.data?.items[0];

  let serverNeedsConfig =
    variant?.currentVersion?.schema.schema &&
    Object.entries(variant?.currentVersion?.schema.schema?.properties ?? {}).length > 0;

  if (!serverNeedsConfig && currentStep == 1) currentStep = 2;

  let loading =
    (p.type == 'update' && deployment.isLoading) || (serverId && variants.isLoading);

  let form = useForm({
    initialValues: {
      name: deployment?.data?.name ?? '',
      description: deployment?.data?.description ?? '',
      metadata: deployment?.data?.metadata ?? {},
      config: deployment?.data?.config ?? {}
    },
    schema: yup =>
      yup.object({
        name: yup.string(),
        description: yup.string().optional(),
        metadata: yup.object().optional(),
        config: yup.object()
      }),
    onSubmit: async values => {
      if (p.type == 'update') {
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

  if (variants.data?.items.length === 0 && p.type == 'create') {
    return <Callout color="orange">This server cannot yet be deployed on Metorial.</Callout>;
  }

  if (loading) return <CenteredSpinner />;

  if (p.type == 'update') {
    return (
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
            Save
          </Button>
        </div>

        {update && <update.RenderError />}
      </Form>
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
                    setSearchServer(server);
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
                  schema={variant?.currentVersion?.schema.schema ?? {}}
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
              disabled={update?.isLoading || create.isLoading}
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
              loading={update?.isLoading || create.isLoading}
              success={update?.isSuccess || create.isSuccess}
              type="submit"
              size="2"
            >
              Create
            </Button>
          )}
        </div>
      )}

      <create.RenderError />
    </Form>
  );
};
