import { useForm } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  DashboardOrganizationsSandboxesListOutput,
  MetorialProject,
  useInstance,
  useSandboxes
} from '@metorial/state';
import { Button, Dialog, Input, showModal, Spacer } from '@metorial/ui';
import React from 'react';
import { useNavigate } from 'react-router-dom';

export let createInstance = (
  project_: MetorialProject & { organization?: { slug: string } }
) =>
  showModal(({ close, dialogProps }) => {
    let navigate = useNavigate();
    let sandboxes = useSandboxes(project_.organizationId, { projectId: project_.id });
    let create = sandboxes.createMutator();

    let form = useForm({
      initialValues: {
        name: ''
      },
      onSubmit: async values => {
        let [res] = await create.mutate({
          name: values.name,
          projectId: project_.id
        });

        if (res) {
          close();
          if (project_.organization) {
            navigate(
              Paths.instance(project_.organization, res.instance.project, res.instance)
            );
          }
        }
      },
      schema: yup =>
        yup.object().shape({
          name: yup.string().required('Name is required')
        })
    });

    return (
      <Dialog.Wrapper {...dialogProps}>
        <Dialog.Title>Create Sandbox</Dialog.Title>
        <Dialog.Description>
          Create a development sandbox environment for this project.
        </Dialog.Description>

        <form onSubmit={form.handleSubmit}>
          <Input label="Name" {...form.getFieldProps('name')} />
          <form.RenderError field="name" />

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

export let updateSandbox = (
  sandbox_: DashboardOrganizationsSandboxesListOutput['items'][number]
) =>
  showModal(({ close, dialogProps }) => {
    let sandboxes = useSandboxes(sandbox_.organizationId, {
      projectId: sandbox_.instance.project.id
    });
    let update = sandboxes.updateMutator();

    let form = useForm({
      initialValues: {
        name: sandbox_.name
      },
      updateInitialValues: true,
      onSubmit: async values => {
        let [res] = await update.mutate({
          sandboxId: sandbox_.id,
          name: values.name
        });
        if (res) close();
      },
      schema: yup =>
        yup.object().shape({
          name: yup.string().required('Name is required')
        })
    });

    return (
      <Dialog.Wrapper {...dialogProps}>
        <Dialog.Title>Edit Sandbox</Dialog.Title>
        <Dialog.Description>
          You can edit the name of this sandbox environment.
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

export let updateInstance = (instance_: { id: string; organizationId: string }) =>
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
          name: yup.string().required('Name is required'),
          environment: yup
            .string()
            .oneOf(['development', 'production'] as const)
            .required('Environment is required')
        })
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
