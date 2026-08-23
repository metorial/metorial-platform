import { useForm } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  MetorialOrganization,
  MetorialProject,
  useProject,
  useProjects
} from '@metorial/state';
import { Button, Dialog, Input, showModal, Spacer } from '@metorial/ui';
import React from 'react';

export let createProject = (
  org: MetorialOrganization,
  opts?: {
    noRedirect?: boolean;
  }
) =>
  showModal(({ close, dialogProps }) => {
    let projects = useProjects(org.id);
    let create = projects.createMutator();

    let form = useForm({
      initialValues: {
        name: ''
      },
      onSubmit: async values => {
        let [project] = await create.mutate(values);

        if (project) {
          if (!opts?.noRedirect) {
            setTimeout(() => {
              close();
              let instance = project.instances[0];
              window.location.href = Paths.instance(org, project, instance);
            }, 2000);
          } else {
            close();
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
        <Dialog.Title>Create Project</Dialog.Title>
        <Dialog.Description>Let's create your new project.</Dialog.Description>

        <form onSubmit={form.handleSubmit}>
          <Input label="Name" {...form.getFieldProps('name')} />
          <form.RenderError field="name" />

          <Spacer size={15} />

          <Dialog.Actions>
            <Button
              fullWidth
              type="submit"
              loading={create.isLoading}
              success={create.isSuccessPermanent}
            >
              Create
            </Button>
          </Dialog.Actions>

          <create.RenderError />
        </form>
      </Dialog.Wrapper>
    );
  });

export let updateProject = (project: MetorialProject) =>
  showModal(({ close, dialogProps }) => {
    let projects = useProject(project.organizationId, project.id);
    let update = projects.updateMutator();

    let form = useForm({
      initialValues: {
        name: project.name
      },
      onSubmit: async values => {
        let [res] = await update.mutate(values);
        if (res) close();
      },
      schema: yup =>
        yup.object().shape({
          name: yup.string().required('Name is required')
        })
    });

    return (
      <Dialog.Wrapper {...dialogProps}>
        <Dialog.Title>Edit Project</Dialog.Title>
        <Dialog.Description>You can edit the name of this project.</Dialog.Description>

        <form onSubmit={form.handleSubmit}>
          <Input label="Name" {...form.getFieldProps('name')} />
          <form.RenderError field="name" />

          <Spacer size={15} />

          <Dialog.Actions>
            <Button
              fullWidth
              type="submit"
              loading={update.isLoading}
              success={update.isSuccess}
            >
              Update
            </Button>
          </Dialog.Actions>

          <update.RenderError />
        </form>
      </Dialog.Wrapper>
    );
  });
