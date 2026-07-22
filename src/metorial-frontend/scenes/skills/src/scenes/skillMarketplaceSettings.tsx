import { renderWithLoader, useForm } from '@metorial/data-hooks';
import { useSkillMarketplace, useSkillPlugin } from '@metorial/state';
import { Button, Callout, Input, Select, Spacer, Switch, Text, confirm } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import styled from 'styled-components';
import { ResourceImageUploader } from '../components/skillImageUploader';
import {
  SkillMarketplaceRepositoriesSettingsBox,
  SkillPluginRepositoriesSettingsBox
} from './skillRepositories';

let PageStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

let FormStack = styled.div`
  display: flex;
  flex-direction: column;
`;

let ActionsRow = styled.div`
  display: flex;
  justify-content: flex-end;
`;

export let SkillMarketplaceRepositoryAccessSettings = (p: {
  instanceId: string | null | undefined;
  skillMarketplaceId: string | null | undefined;
  boxed?: boolean;
  onSaveSuccess?: () => void | Promise<void>;
}) => {
  let marketplace = useSkillMarketplace(p.instanceId, p.skillMarketplaceId);
  let updateMutator = marketplace.updateMutator();
  let repositorySettings = marketplace.data;
  let form = useForm({
    initialValues: {
      repositoryAccessMode: marketplace.data?.repositoryAccessMode ?? 'pull_request',
      forceMergeOrPush: repositorySettings?.forceMergeOrPush ?? false,
      mergeBeforeChecksPass: repositorySettings?.mergeBeforeChecksPass ?? false
    },
    updateInitialValues: true,
    onSubmit: async values => {
      let update = async () => {
        let [updated] = await updateMutator.mutate({
          repositoryAccessMode: values.repositoryAccessMode,
          forceMergeOrPush: values.forceMergeOrPush,
          mergeBeforeChecksPass: values.mergeBeforeChecksPass
        });
        if (updated) await p.onSaveSuccess?.();
      };
      let enablingDefaultBranch =
        marketplace.data?.repositoryAccessMode !== 'default_branch' &&
        values.repositoryAccessMode === 'default_branch';
      let enablingForce = !repositorySettings?.forceMergeOrPush && values.forceMergeOrPush;
      let enablingEarlyMerge =
        values.repositoryAccessMode === 'pull_request' &&
        !repositorySettings?.mergeBeforeChecksPass &&
        values.mergeBeforeChecksPass;
      let enabledRisks = [
        enablingDefaultBranch ? 'push directly to default branches' : null,
        enablingForce
          ? values.repositoryAccessMode === 'default_branch'
            ? 'try the strongest safe direct write'
            : 'try to bypass failed checks or missing reviews'
          : null,
        enablingEarlyMerge ? 'merge before required checks pass' : null
      ].filter((risk): risk is string => risk != null);

      if (enabledRisks.length > 0) {
        confirm({
          title: 'Enable repository overrides?',
          description: `Future marketplace syncs may ${enabledRisks.join(', and ')}.`,
          confirmText: 'Enable and Save',
          onConfirm: update
        });
        return;
      }
      await update();
    },
    schema: yup =>
      yup.object({
        repositoryAccessMode: yup
          .mixed<'pull_request' | 'default_branch'>()
          .oneOf(['pull_request', 'default_branch'])
          .required(),
        forceMergeOrPush: yup.boolean().required(),
        mergeBeforeChecksPass: yup.boolean().required()
      })
  });

  return renderWithLoader({ marketplace })(() => {
    let content = (
      <form onSubmit={form.handleSubmit}>
        <FormStack>
          <Select
            label="Access Mode"
            value={form.values.repositoryAccessMode}
            items={[
              { id: 'pull_request', label: 'Pull/merge request (recommended)' },
              { id: 'default_branch', label: 'Default branch' }
            ]}
            onChange={value => form.setFieldValue('repositoryAccessMode', value)}
          />

          <Spacer size={5} />

          <Text color="gray600" size="2">
            {form.values.repositoryAccessMode === 'default_branch'
              ? `Push directly to each repository's default branch. Checks and reviews are skipped, and repository rules may block the sync.`
              : 'Create a pull/merge request and merge after required checks and reviews pass.'}
          </Text>

          <Spacer size={15} />

          <Switch
            label="Force merge or push"
            description={
              form.values.repositoryAccessMode === 'default_branch'
                ? 'Try the strongest safe direct write. Branch rules may still block the update.'
                : 'Try to bypass failed checks or missing reviews. Repository rules may still block the update.'
            }
            checked={form.values.forceMergeOrPush}
            onCheckedChange={checked => form.setFieldValue('forceMergeOrPush', checked)}
          />
          <form.RenderError field="forceMergeOrPush" />

          <Spacer size={15} />

          <Switch
            label="Merge before checks pass"
            description={
              form.values.repositoryAccessMode === 'default_branch'
                ? 'Only applies to pull/merge requests.'
                : 'Try once while checks are still running.'
            }
            checked={
              form.values.repositoryAccessMode === 'pull_request' &&
              form.values.mergeBeforeChecksPass
            }
            disabled={form.values.repositoryAccessMode === 'default_branch'}
            onCheckedChange={checked => form.setFieldValue('mergeBeforeChecksPass', checked)}
          />
          <form.RenderError field="mergeBeforeChecksPass" />

          <Spacer size={10} />

          <ActionsRow>
            <Button
              loading={updateMutator.isLoading}
              size="2"
              success={updateMutator.isSuccess}
              type="submit"
            >
              Save
            </Button>
          </ActionsRow>
          <updateMutator.RenderError />
        </FormStack>
      </form>
    );

    return p.boxed === false ? (
      content
    ) : (
      <Box
        title="Repository Access"
        description="Choose how marketplace changes are written to linked repositories."
      >
        {content}
      </Box>
    );
  });
};

export let SkillMarketplaceSettingsScene = (p: {
  instanceId: string | null | undefined;
  skillMarketplaceId: string | null | undefined;
  onDeleteSuccess?: () => void;
}) => {
  let marketplace = useSkillMarketplace(p.instanceId, p.skillMarketplaceId);
  let syncMarketplace = marketplace.syncMutator();

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
      {marketplace.data?.syncStatus !== 'synced' && (
        <>
          <Callout color="blue">
            <span>
              <strong>Upcoming changes:</strong> Plugins, skills, or configurations linked to
              this marketplace have changed. Metorial is processing these changes and updating
              the marketplace. This can take a few minutes.
            </span>
            {marketplace.data?.syncStatus === 'pending' && (
              <Button
                size="2"
                loading={syncMarketplace.isLoading}
                onClick={() => syncMarketplace.mutate({})}
                style={{ marginLeft: 16 }}
              >
                Sync Now
              </Button>
            )}
          </Callout>
        </>
      )}

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

            <Spacer size={10} />

            <Input
              as="textarea"
              label="Description"
              minRows={4}
              {...form.getFieldProps('description')}
            />
            <form.RenderError field="description" />

            <Spacer size={10} />

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

      <SkillMarketplaceRepositoryAccessSettings
        instanceId={p.instanceId}
        skillMarketplaceId={p.skillMarketplaceId}
      />

      <SkillMarketplaceRepositoriesSettingsBox
        instanceId={p.instanceId}
        skillMarketplaceId={p.skillMarketplaceId}
      />

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

      <SkillPluginRepositoriesSettingsBox
        instanceId={p.instanceId}
        skillPluginId={p.skillPluginId}
      />

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
