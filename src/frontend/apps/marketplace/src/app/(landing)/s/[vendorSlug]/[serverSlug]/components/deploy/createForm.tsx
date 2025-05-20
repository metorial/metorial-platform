'use client';

import {
  Button,
  Checkbox,
  Dialog,
  Error,
  Input,
  showModal,
  Spacer,
  Spinner,
  Text
} from '@metorial/ui';
import { useEffect, useRef } from 'react';
import styled from 'styled-components';
import { useForm } from '../../../../../../../hooks/use-form';
import { showAuth } from '../../../../../../../scenes/auth/showAuth';
import { loggedIn } from '../../../../../../../state/client/auth';
import { useServerInstances } from '../../../../../../../state/client/serverInstance';
import { FullServer } from '../../../../../../../state/server';

let Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

export let CreateServerInstanceForm = ({
  server,
  onDeployed,
  isUnauthenticated
}: {
  server: FullServer;
  onDeployed?: () => void;
  isUnauthenticated?: boolean;
}) => {
  let instances = useServerInstances(server);
  // let user = useUser();
  let createServerInstance = instances.createServerInstance;

  let fields = server.current_version?.config.fields ?? [];

  let autoCreatingRef = useRef(false);

  let form = useForm({
    initialValues: Object.fromEntries(fields.map(field => [field.key, field.default ?? ''])),
    schema: yup =>
      yup.object(
        Object.fromEntries(
          fields.map(field => {
            let schema =
              {
                input_short: yup.string(),
                input_long: yup.string(),
                input_number: yup.number(),
                input_boolean: yup.boolean()
              }[field.type] ?? yup.string();

            return [
              field.key,
              field.required ? schema.required(`${field.title} is required`) : schema
            ];
          })
        )
      ),
    onSubmit: async values => {
      while (loggedIn.get() == 'pending') {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      if (loggedIn.get() == 'not_logged_in') {
        await showAuth({
          type: 'signup'
        });
      }

      createServerInstance
        .mutateAsync({
          config: values
        })
        .then(() => {
          onDeployed?.();
        })
        .catch(err => {});
    }
  });

  useEffect(() => {
    if (!instances.data || fields.length || autoCreatingRef.current) return;
    autoCreatingRef.current = true;

    form.submitForm();
  }, [instances.data, fields]);

  if (!isUnauthenticated && ((!instances.data && !instances.error) || fields.length === 0))
    return <Spinner />;

  return (
    <Form onSubmit={form.handleSubmit}>
      {server.current_version?.config.fields.map(field => {
        return (
          <div key={field.key}>
            {field.type == 'input_boolean' ? (
              <Checkbox
                label={field.title}
                checked={form.values[field.key] as boolean}
                onCheckedChange={checked => form.setFieldValue(field.key, checked)}
              />
            ) : (
              <Input label={field.title} {...form.getFieldProps(field.key)} />
            )}
            <form.RenderError field={field.key} />
          </div>
        );
      })}

      <div>
        <Button
          type="submit"
          loading={createServerInstance.isPending}
          success={createServerInstance.isSuccess}
          size="1"
        >
          Deploy {server.name}
        </Button>
        <Spacer height={4} />
        <Text size="1" weight="medium" color="gray600">
          Your configuration is encrypted.
        </Text>
        {createServerInstance.error && <Error>{createServerInstance.error.message}</Error>}
      </div>
    </Form>
  );
};

export let openCreateServerInstanceModal = (server: FullServer) =>
  showModal(({ dialogProps, close }) => {
    return (
      <Dialog.Wrapper {...dialogProps}>
        <Dialog.Title>
          Deploy <span>{server.name}</span>
        </Dialog.Title>

        <Dialog.Description>
          Let's create your instance of {server.name} with the following configuration.
        </Dialog.Description>

        <CreateServerInstanceForm server={server} onDeployed={close} />
      </Dialog.Wrapper>
    );
  });
