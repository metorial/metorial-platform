import { useForm } from '@metorial/data-hooks';
import { MetorialInstance, MetorialProject, useInstance, useInstances } from '@metorial/state';
import { Button, Dialog, Input, Select, showModal, Spacer } from '@metorial/ui';
import React from 'react';

export let createInstance = (project_: MetorialProject) =>
  showModal(({ close, dialogProps }) => {
    let instances = useInstances(project_.organizationId);
    let create = instances.createMutator();

    let form = useForm({
      initialValues: {
        name: '',
        type: 'development' as 'development' | 'production'
      },
      onSubmit: async values => {
        let [res] = await create.mutate({
          ...values,
          projectId: project_.id
        });

        if (res) {
          close();
          // setTimeout(() => window.location.reload(), 50);
        }
      },
      schema: yup =>
        yup.object().shape({
          name: yup.string().required('Name is required'),
          type: yup.string().required('Environment is required')
        }) as any
    });

    return (
      <Dialog.Wrapper {...dialogProps}>
        <Dialog.Title>Create Environment</Dialog.Title>
        <Dialog.Description>
          You can create multiple project instances for different environments. For example,
          one for production, one for staging, and one for development.
        </Dialog.Description>

        <form onSubmit={form.handleSubmit}>
          <Input label="Name" {...form.getFieldProps('name')} />
          <form.RenderError field="name" />

          <Spacer size={15} />

          <Select
            label="Environment"
            items={[
              { id: 'development', label: 'Staging' },
              { id: 'production', label: 'Production' }
            ]}
            value={form.values.type}
            onChange={value => form.setFieldValue('type', value)}
          />

          <Spacer size={15} />

          <Dialog.Actions>
            <Button
              fullWidth
              type="submit"
              loading={create.isLoading}
              success={create.isSuccess}
            >
              Create
            </Button>
          </Dialog.Actions>

          <create.RenderError />
        </form>
      </Dialog.Wrapper>
    );
  });

export let updateInstance = (instance_: MetorialInstance) =>
  showModal(({ close, dialogProps }) => {
    let instance = useInstance(instance_.organizationId, instance_.id);
    let update = instance.updateMutator();

    let form = useForm({
      initialValues: {
        name: instance.data?.name,
        environment: instance.data?.type
      },
      updateInitialValues: true,
      onSubmit: async values => {
        let [res] = await update.mutate(values);
        if (res) close();
      },
      schema: yup =>
        yup.object().shape({
          name: yup.string().required('Name is required')
        }) as any
    });

    return (
      <Dialog.Wrapper {...dialogProps}>
        <Dialog.Title>Edit Environment</Dialog.Title>
        <Dialog.Description>
          You can edit the name and environment of this instance.
        </Dialog.Description>

        <form onSubmit={form.handleSubmit}>
          <Input label="Name" {...form.getFieldProps('name')} />
          <form.RenderError field="name" />

          <Spacer size={15} />

          <Dialog.Actions>
            <Button type="button" disabled={update.isLoading} onClick={close}>
              Cancel
            </Button>

            <Button type="submit" loading={update.isLoading} success={update.isSuccess}>
              Save
            </Button>
          </Dialog.Actions>

          <update.RenderError />
        </form>
      </Dialog.Wrapper>
    );
  });
