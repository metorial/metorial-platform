import { renderWithLoader, renderWithPagination, useForm } from '@metorial/data-hooks';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCreateProviderTemplate,
  useCurrentInstance,
  useDeleteProviderTemplate,
  useProviderDeployments,
  useProviderTemplates,
  useUpdateProviderTemplate
} from '@metorial/state';
import {
  Button,
  confirm,
  Dialog,
  Entity,
  Input,
  RenderDate,
  Select,
  Spacer,
  Text,
  showModal
} from '@metorial/ui';
import { useEffect, useState } from 'react';
import styled from 'styled-components';

let TemplateList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

let TemplateActions = styled.div`
  display: flex;
  gap: 10px;
  padding: 0 16px 16px;
`;

let showCreateProviderTemplateModal = (props: { instanceId: string; onCreate: () => void }) =>
  showModal(({ dialogProps, close }) => {
    let createProviderTemplate = useCreateProviderTemplate();
    let deployments = useProviderDeployments(props.instanceId, { limit: 100 });
    let deploymentItems = (deployments.data?.items ?? []).map(deployment => ({
      id: deployment.id,
      label: deployment.name ?? deployment.id
    }));

    let form = useForm({
      initialValues: {
        name: '',
        description: '',
        providerDeploymentId: ''
      },
      schema: yup =>
        yup.object({
          name: yup.string().required('Name is required'),
          description: yup.string(),
          providerDeploymentId: yup.string().required('Select a deployment')
        }),
      onSubmit: async values => {
        let [created] = await createProviderTemplate.mutate({
          instanceId: props.instanceId,
          name: values.name,
          description: values.description || undefined,
          providerDeploymentId: values.providerDeploymentId
        });

        if (!created) return;

        props.onCreate();
        close();
      }
    });

    useEffect(() => {
      if (form.values.providerDeploymentId || !deploymentItems[0]?.id) return;
      form.setFieldValue('providerDeploymentId', deploymentItems[0].id);
    }, [deploymentItems, form]);

    return (
      <Dialog.Wrapper {...dialogProps} width={560}>
        <Dialog.Title>Create Provider Template</Dialog.Title>
        <Dialog.Description>
          Turn an existing deployment into a reusable portal catalog item.
        </Dialog.Description>

        <form onSubmit={form.handleSubmit}>
          <Input label="Name" {...form.getFieldProps('name')} />
          <form.RenderError field="name" />

          <Spacer size={15} />

          <Input label="Description" {...form.getFieldProps('description')} />
          <form.RenderError field="description" />

          <Spacer size={15} />

          <Select
            label="Deployment"
            value={form.values.providerDeploymentId}
            items={deploymentItems}
            onChange={value => form.setFieldValue('providerDeploymentId', value)}
          />
          <form.RenderError field="providerDeploymentId" />

          {deploymentItems.length === 0 && (
            <>
              <Spacer size={10} />
              <Text size="2" color="gray600">
                No provider deployments are available for this instance yet.
              </Text>
            </>
          )}

          <Spacer size={20} />

          <Dialog.Actions>
            <Button type="button" variant="soft" onClick={close}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={createProviderTemplate.isLoading}
              disabled={!deploymentItems.length}
            >
              Create Template
            </Button>
          </Dialog.Actions>
        </form>
      </Dialog.Wrapper>
    );
  });

let showEditProviderTemplateModal = (props: {
  instanceId: string;
  providerTemplate: {
    id: string;
    name: string;
    description: string | null;
  };
  onUpdate: () => void;
}) =>
  showModal(({ dialogProps, close }) => {
    let updateProviderTemplate = useUpdateProviderTemplate();

    let form = useForm({
      initialValues: {
        name: props.providerTemplate.name,
        description: props.providerTemplate.description ?? ''
      },
      schema: yup =>
        yup.object({
          name: yup.string().required('Name is required'),
          description: yup.string()
        }),
      onSubmit: async values => {
        let [updated] = await updateProviderTemplate.mutate({
          instanceId: props.instanceId,
          providerTemplateId: props.providerTemplate.id,
          body: {
            name: values.name,
            description: values.description || undefined
          }
        });

        if (!updated) return;

        props.onUpdate();
        close();
      }
    });

    return (
      <Dialog.Wrapper {...dialogProps} width={560}>
        <Dialog.Title>Edit Provider Template</Dialog.Title>
        <Dialog.Description>
          Update the consumer-facing name and description for this portal catalog item.
        </Dialog.Description>

        <form onSubmit={form.handleSubmit}>
          <Input label="Name" {...form.getFieldProps('name')} />
          <form.RenderError field="name" />

          <Spacer size={15} />

          <Input label="Description" {...form.getFieldProps('description')} />
          <form.RenderError field="description" />

          <Spacer size={20} />

          <Dialog.Actions>
            <Button type="button" variant="soft" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" loading={updateProviderTemplate.isLoading}>
              Save
            </Button>
          </Dialog.Actions>
        </form>
      </Dialog.Wrapper>
    );
  });

export let ProviderTemplatesPage = () => {
  let instance = useCurrentInstance();
  let providerTemplates = useProviderTemplates(instance.data?.id);
  let deleteProviderTemplate = useDeleteProviderTemplate();
  let [archivingProviderTemplateId, setArchivingProviderTemplateId] = useState<string | null>(
    null
  );

  return renderWithLoader({ instance })(({ instance }) => (
    <ContentLayout>
      <PageHeader
        title="Provider Templates"
        description="Manage the reusable provider templates exposed through portals."
        actions={
          <Button
            size="2"
            onClick={() =>
              showCreateProviderTemplateModal({
                instanceId: instance.data.id,
                onCreate: () => providerTemplates.refetch()
              })
            }
          >
            Create Template
          </Button>
        }
      />

      {renderWithPagination(providerTemplates, {
        hidePaginationWhenUnavailable: true
      })(templatesPage => (
        <TemplateList>
          {templatesPage.data.items.map(template => (
            <Entity.Wrapper key={template.id}>
              <Entity.Content>
                <Entity.Field
                  title={template.name}
                  value={template.description ?? 'No description'}
                />
                <Entity.Field title="Status" value={template.status} />
                <Entity.Field title="Deployment" value={template.providerDeploymentId} />
                <Entity.Field
                  title="Created"
                  value={<RenderDate date={template.createdAt} />}
                />
              </Entity.Content>

              <TemplateActions>
                <Button
                  size="2"
                  variant="soft"
                  onClick={() =>
                    showEditProviderTemplateModal({
                      instanceId: instance.data.id,
                      providerTemplate: {
                        id: template.id,
                        name: template.name,
                        description: template.description ?? null
                      },
                      onUpdate: () => providerTemplates.refetch()
                    })
                  }
                >
                  Edit
                </Button>

                <Button
                  color="red"
                  variant="soft"
                  size="2"
                  loading={
                    archivingProviderTemplateId == template.id &&
                    deleteProviderTemplate.isLoading
                  }
                  onClick={() => {
                    confirm({
                      title: 'Archive provider template',
                      description:
                        'Archive this provider template and remove it from the portal catalog.',
                      onConfirm: async () => {
                        setArchivingProviderTemplateId(template.id);

                        try {
                          let [archived] = await deleteProviderTemplate.mutate({
                            instanceId: instance.data.id,
                            providerTemplateId: template.id
                          });

                          if (archived) {
                            providerTemplates.refetch();
                          }
                        } finally {
                          setArchivingProviderTemplateId(null);
                        }
                      }
                    });
                  }}
                >
                  Archive
                </Button>
              </TemplateActions>
            </Entity.Wrapper>
          ))}

          {templatesPage.data.items.length === 0 && (
            <Text size="2" color="gray600">
              You haven't created any provider templates yet. Create one to start building your
              portal catalog.
            </Text>
          )}
        </TemplateList>
      ))}
    </ContentLayout>
  ));
};
