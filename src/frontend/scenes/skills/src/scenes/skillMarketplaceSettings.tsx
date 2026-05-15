import { renderWithLoader, useForm } from '@metorial/data-hooks';
import { useSkillMarketplace, useSkillPlugin } from '@metorial/state';
import { Button, Input, Spacer, confirm } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import styled from 'styled-components';
import { ResourceImageUploader } from '../components/skillImageUploader';

let PageStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

let FormStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

let ActionsRow = styled.div`
  display: flex;
  justify-content: flex-end;
`;

export let SkillMarketplaceSettingsScene = (p: {
  instanceId: string | null | undefined;
  skillMarketplaceId: string | null | undefined;
  onDeleteSuccess?: () => void;
}) => {
  let marketplace = useSkillMarketplace(p.instanceId, p.skillMarketplaceId);
  let imageUpdateMutator = marketplace.updateMutator();
  let generalUpdateMutator = marketplace.updateMutator();
  let deleteMutator = marketplace.deleteMutator();

  let form = useForm({
    initialValues: {
      name: marketplace.data?.name ?? '',
      description: marketplace.data?.description ?? ''
    },
    updateInitialValues: true,
    onSubmit: async values => {
      await generalUpdateMutator.mutate({
        name: values.name.trim(),
        description: values.description.trim() || undefined
      });
    },
    schema: yup =>
      yup.object({
        name: yup.string().trim().required('Name is required'),
        description: yup.string().ensure()
      })
  });

  return renderWithLoader({ marketplace })(({ marketplace }) => (
    <PageStack>
      {p.instanceId && (
        <Box
          title="Marketplace Image"
          description="Upload the image shown for this marketplace in discovery flows."
        >
          <ResourceImageUploader
            instanceId={p.instanceId}
            resource={marketplace.data}
            updateResource={imageUpdateMutator}
            description="Upload an image to represent this marketplace in discovery flows."
          />

          <Spacer size={10} />
          <imageUpdateMutator.RenderError />
        </Box>
      )}

      <Box
        title="General Settings"
        description="Manage the name and description for this skill marketplace."
      >
        <form onSubmit={form.handleSubmit}>
          <FormStack>
            <Input label="Name" {...form.getFieldProps('name')} />
            <form.RenderError field="name" />

            <Input
              as="textarea"
              label="Description"
              minRows={4}
              {...form.getFieldProps('description')}
            />
            <form.RenderError field="description" />

            <ActionsRow>
              <Button
                loading={generalUpdateMutator.isLoading}
                size="2"
                success={generalUpdateMutator.isSuccess}
                type="submit"
              >
                Save
              </Button>
            </ActionsRow>

            <generalUpdateMutator.RenderError />
          </FormStack>
        </form>
      </Box>

      <Box
        title="Danger Zone"
        description="Delete this marketplace. Linked plugins and skills will remain available."
      >
        <Button
          color="red"
          loading={deleteMutator.isLoading}
          onClick={() =>
            confirm({
              title: `Delete ${marketplace.data.name}?`,
              description: 'Are you sure you want to delete this skill marketplace?',
              confirmText: 'Delete',
              onConfirm: async () => {
                let [result] = await deleteMutator.mutate(undefined as never);
                if (result) {
                  await p.onDeleteSuccess?.();
                }
              }
            })
          }
          size="2"
          success={deleteMutator.isSuccess}
          type="button"
        >
          Delete Marketplace
        </Button>

        <Spacer size={10} />
        <deleteMutator.RenderError />
      </Box>
    </PageStack>
  ));
};

export let SkillPluginSettingsScene = (p: {
  instanceId: string | null | undefined;
  skillPluginId: string | null | undefined;
  onDeleteSuccess?: () => void;
}) => {
  let plugin = useSkillPlugin(p.instanceId, p.skillPluginId);
  let imageUpdateMutator = plugin.updateMutator();
  let generalUpdateMutator = plugin.updateMutator();
  let deleteMutator = plugin.deleteMutator();

  let form = useForm({
    initialValues: {
      name: plugin.data?.name ?? '',
      description: plugin.data?.description ?? '',
      longDescription: plugin.data?.longDescription ?? '',
      category: plugin.data?.category ?? ''
    },
    updateInitialValues: true,
    onSubmit: async values => {
      await generalUpdateMutator.mutate({
        name: values.name.trim(),
        description: values.description.trim() || undefined,
        longDescription: values.longDescription.trim() || undefined,
        category: values.category.trim() || undefined
      });
    },
    schema: yup =>
      yup.object({
        name: yup.string().trim().required('Name is required'),
        description: yup.string().ensure(),
        longDescription: yup.string().ensure(),
        category: yup.string().ensure()
      })
  });

  return renderWithLoader({ plugin })(({ plugin }) => (
    <PageStack>
      {p.instanceId && (
        <Box
          title="Plugin Image"
          description="Upload the image shown for this plugin in marketplaces and discovery flows."
        >
          <ResourceImageUploader
            instanceId={p.instanceId}
            resource={plugin.data}
            updateResource={imageUpdateMutator}
            description="Upload an image to represent this plugin in marketplaces and discovery flows."
          />

          <Spacer size={10} />
          <imageUpdateMutator.RenderError />
        </Box>
      )}

      <Box
        title="General Settings"
        description="Manage the name, description, and category for this skill plugin."
      >
        <form onSubmit={form.handleSubmit}>
          <FormStack>
            <Input label="Name" {...form.getFieldProps('name')} />
            <form.RenderError field="name" />

            <Input
              as="textarea"
              label="Description"
              minRows={3}
              {...form.getFieldProps('description')}
            />
            <form.RenderError field="description" />

            <Input
              as="textarea"
              label="Long description"
              minRows={5}
              {...form.getFieldProps('longDescription')}
            />
            <form.RenderError field="longDescription" />

            <Input label="Category" {...form.getFieldProps('category')} />
            <form.RenderError field="category" />

            <ActionsRow>
              <Button
                loading={generalUpdateMutator.isLoading}
                size="2"
                success={generalUpdateMutator.isSuccess}
                type="submit"
              >
                Save
              </Button>
            </ActionsRow>

            <generalUpdateMutator.RenderError />
          </FormStack>
        </form>
      </Box>

      <Box
        title="Danger Zone"
        description="Delete this plugin. Skills linked to it will remain available."
      >
        <Button
          color="red"
          loading={deleteMutator.isLoading}
          onClick={() =>
            confirm({
              title: `Delete ${plugin.data.name}?`,
              description: 'Are you sure you want to delete this skill plugin?',
              confirmText: 'Delete',
              onConfirm: async () => {
                let [result] = await deleteMutator.mutate(undefined as never);
                if (result) {
                  await p.onDeleteSuccess?.();
                }
              }
            })
          }
          size="2"
          success={deleteMutator.isSuccess}
          type="button"
        >
          Delete Plugin
        </Button>

        <Spacer size={10} />
        <deleteMutator.RenderError />
      </Box>
    </PageStack>
  ));
};
