import { useForm } from '@metorial/data-hooks';
import {
  ResourcePicker,
  showResourcePicker,
  submitEach,
  useResourcePicker
} from '@metorial/access-ui';
import {
  type Skill,
  type SkillGroup,
  type SkillMarketplace,
  type SkillPlugin,
  skillGroupsLoader,
  skillMarketplacesLoader,
  skillPluginsLoader,
  skillsLoader,
  useCreateSkillPlugin,
  useUpdateSkillPlugin
} from '@metorial/state';
import { Button, Dialog, Input, Select, showModal } from '@metorial/ui';
import { useMemo, useState } from 'react';
import styled from 'styled-components';
import { useEntityPickerSource } from '../../components/entityPickerSource';
import type { MoveDestination } from './hierarchy';

let addConcurrency = 10;

let FormStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

let DestinationSelect = styled.div`
  flex: 0 1 260px;
  min-width: 180px;
`;

let countOf = (count: number, one: string, many: string) =>
  count == 1 ? `1 ${one}` : `${count} ${many}`;

export type AddSkillsDestinationOption = { id: string; label: string };

let AddSkillsPanel = (p: {
  instanceId: string;
  linkedSkillIds: Record<string, string[]>;
  destinations: AddSkillsDestinationOption[];
  initialDestination: string;
  close: () => void;
  onAdd: (skills: Skill[], destination: MoveDestination) => Promise<{ failed: string[] }>;
}) => {
  let picker = useResourcePicker<Skill>();
  let [destination, setDestination] = useState(p.initialDestination);
  let linked = useMemo(
    () => new Set(p.linkedSkillIds[destination] ?? []),
    [p.linkedSkillIds, destination]
  );
  let destinationLabel = p.destinations.find(option => option.id == destination)?.label;

  let source = useEntityPickerSource({
    loader: skillsLoader,
    input: { instanceId: p.instanceId, status: ['active'], search: picker.query },
    kind: 'skill',
    subtitle: skill => skill.slug,
    exclude: skill => linked.has(skill.id),
    resetKey: destination
  });

  let changeDestination = (value: string) => {
    let nextLinked = new Set(p.linkedSkillIds[value] ?? []);
    setDestination(value);

    for (let selection of picker.selected) {
      if (nextLinked.has(selection.item.key)) picker.remove(selection.item.key);
    }
  };

  return (
    <ResourcePicker
      picker={picker}
      title="Add Skills"
      description="Pick skills and choose whether they join a plugin or stand on their own."
      placeholder="Search skills…"
      toolbar={
        <DestinationSelect>
          <Select
            label="Add To"
            hideLabel
            value={destination}
            onChange={changeDestination}
            items={p.destinations}
          />
        </DestinationSelect>
      }
      source={source}
      empty={{ title: 'Every skill is already here.' }}
      verb="Add"
      success={count =>
        `Added ${countOf(count, 'skill', 'skills')} to ${destinationLabel ?? 'the marketplace'}.`
      }
      onSubmit={selected =>
        p.onAdd(
          selected.map(selection => selection.value),
          destination === 'standalone'
            ? { type: 'standalone' }
            : { type: 'plugin', pluginId: destination }
        )
      }
      close={p.close}
    />
  );
};

export let showAddSkillsPanel = (p: Omit<Parameters<typeof AddSkillsPanel>[0], 'close'>) =>
  showResourcePicker(close => <AddSkillsPanel {...p} close={close} />);

let SkillGroupPickerPanel = (p: {
  instanceId: string;
  excludeSkillIds: string[];
  close: () => void;
  onSelect: (skill: Skill) => Promise<boolean>;
  onDone?: () => Promise<void> | void;
}) => {
  let picker = useResourcePicker<Skill>();
  let excluded = useMemo(() => new Set(p.excludeSkillIds), [p.excludeSkillIds]);

  let source = useEntityPickerSource({
    loader: skillsLoader,
    input: { instanceId: p.instanceId, status: ['active'], search: picker.query },
    kind: 'skill',
    subtitle: skill => skill.slug,
    exclude: skill => excluded.has(skill.id)
  });

  return (
    <ResourcePicker
      picker={picker}
      title="Add Skills"
      description="Pick one or more skills to add to this group."
      placeholder="Search skills…"
      source={source}
      empty={{ title: 'Every skill is already in this group.' }}
      verb="Add"
      success={count => `Added ${countOf(count, 'skill', 'skills')} to the group.`}
      onSubmit={async selected => {
        let result = await submitEach(selected, selection => p.onSelect(selection.value), {
          concurrency: addConcurrency
        });
        await p.onDone?.();
        return result;
      }}
      close={p.close}
    />
  );
};

export let showSkillGroupSkillsPanel = (
  p: Omit<Parameters<typeof SkillGroupPickerPanel>[0], 'close'>
) => showResourcePicker(close => <SkillGroupPickerPanel {...p} close={close} />);

let PluginPickerPanel = (p: {
  instanceId: string;
  excludePluginIds: string[];
  close: () => void;
  onSelect: (plugin: SkillPlugin) => Promise<boolean>;
}) => {
  let picker = useResourcePicker<SkillPlugin>();
  let excluded = useMemo(() => new Set(p.excludePluginIds), [p.excludePluginIds]);

  let source = useEntityPickerSource({
    loader: skillPluginsLoader,
    input: { instanceId: p.instanceId, status: ['active'], search: picker.query },
    kind: 'skill_plugin',
    exclude: plugin => excluded.has(plugin.id)
  });

  return (
    <ResourcePicker
      picker={picker}
      title="Import Plugin"
      description="Add existing plugins, with all of their skills, to this marketplace."
      placeholder="Search plugins…"
      source={source}
      empty={{ title: 'No additional plugins to add to this marketplace.' }}
      verb="Import"
      success={count => `Imported ${countOf(count, 'plugin', 'plugins')}.`}
      onSubmit={selected =>
        submitEach(selected, selection => p.onSelect(selection.value), {
          concurrency: addConcurrency
        })
      }
      close={p.close}
    />
  );
};

export let showPluginPickerPanel = (
  p: Omit<Parameters<typeof PluginPickerPanel>[0], 'close'>
) => showResourcePicker(close => <PluginPickerPanel {...p} close={close} />);

let PublishSkillGroupPanel = (p: {
  instanceId: string;
  excludeSkillGroupIds: string[];
  close: () => void;
  onSelect: (skillGroup: SkillGroup) => Promise<boolean>;
}) => {
  let picker = useResourcePicker<SkillGroup>();
  let excluded = useMemo(() => new Set(p.excludeSkillGroupIds), [p.excludeSkillGroupIds]);

  let source = useEntityPickerSource({
    loader: skillGroupsLoader,
    input: { instanceId: p.instanceId, status: ['active'], search: picker.query },
    kind: 'skill_group',
    exclude: group => excluded.has(group.id)
  });

  return (
    <ResourcePicker
      picker={picker}
      title="Publish Skill Group"
      description="Each group becomes a plugin in this marketplace. Its skills stay in sync with the group and are managed there."
      placeholder="Search skill groups…"
      source={source}
      empty={{ title: 'Every skill group is already published to this marketplace.' }}
      verb="Publish"
      success={count => `Published ${countOf(count, 'skill group', 'skill groups')}.`}
      onSubmit={selected =>
        submitEach(selected, selection => p.onSelect(selection.value), {
          concurrency: addConcurrency
        })
      }
      close={p.close}
    />
  );
};

let PublishToMarketplacePanel = (p: {
  instanceId: string;
  skillGroupName: string;
  excludeSkillMarketplaceIds: string[];
  close: () => void;
  onSelect: (skillMarketplace: SkillMarketplace) => Promise<boolean>;
}) => {
  let picker = useResourcePicker<SkillMarketplace>();
  let excluded = useMemo(
    () => new Set(p.excludeSkillMarketplaceIds),
    [p.excludeSkillMarketplaceIds]
  );

  let source = useEntityPickerSource({
    loader: skillMarketplacesLoader,
    input: { instanceId: p.instanceId, status: ['active'], search: picker.query },
    kind: 'skill_marketplace',
    exclude: marketplace => excluded.has(marketplace.id) || !marketplace.canCreatePlugins
  });

  return (
    <ResourcePicker
      picker={picker}
      title="Publish to Marketplace"
      description={`${p.skillGroupName} becomes a plugin in each selected marketplace. Its skills stay in sync with this group.`}
      placeholder="Search marketplaces…"
      source={source}
      empty={{ title: 'This group is already published to every marketplace you can edit.' }}
      verb="Publish"
      success={count => `Published to ${countOf(count, 'marketplace', 'marketplaces')}.`}
      onSubmit={selected =>
        submitEach(selected, selection => p.onSelect(selection.value), {
          concurrency: addConcurrency
        })
      }
      close={p.close}
    />
  );
};

export let showPublishToMarketplacePanel = (
  p: Omit<Parameters<typeof PublishToMarketplacePanel>[0], 'close'>
) => showResourcePicker(close => <PublishToMarketplacePanel {...p} close={close} />);

export let showPublishSkillGroupPanel = (
  p: Omit<Parameters<typeof PublishSkillGroupPanel>[0], 'close'>
) => showResourcePicker(close => <PublishSkillGroupPanel {...p} close={close} />);

let PluginForm = (p: {
  instanceId: string;
  skillMarketplaceId: string;
  plugin?: SkillPlugin;
  close: () => void;
  onChanged: (plugin: SkillPlugin) => Promise<void>;
}) => {
  let createPlugin = useCreateSkillPlugin();
  let updatePlugin = useUpdateSkillPlugin();
  let mutator = p.plugin ? updatePlugin : createPlugin;

  let form = useForm({
    initialValues: { name: p.plugin?.name ?? '', description: p.plugin?.description ?? '' },
    onSubmit: async values => {
      let input = {
        name: values.name.trim(),
        description: values.description.trim() || undefined
      };
      let [plugin] = p.plugin
        ? await updatePlugin.mutate({
            instanceId: p.instanceId,
            skillPluginId: p.plugin.id,
            ...input
          })
        : await createPlugin.mutate({
            instanceId: p.instanceId,
            skillMarketplaceId: p.skillMarketplaceId,
            ...input
          });
      if (!plugin) return;

      await p.onChanged(plugin);
      p.close();
    },
    schema: yup =>
      yup.object({
        name: yup.string().trim().required('Name is required'),
        description: yup.string()
      })
  });

  return (
    <form onSubmit={form.handleSubmit}>
      <FormStack>
        <Input label="Name" required autoFocus {...form.getFieldProps('name')} />
        <form.RenderError field="name" />

        <Input
          label="Description"
          as="textarea"
          minRows={3}
          {...form.getFieldProps('description')}
        />
        <form.RenderError field="description" />

        <Dialog.Actions>
          <Button type="button" variant="soft" disabled={mutator.isLoading} onClick={p.close}>
            Cancel
          </Button>
          <Button type="submit" loading={mutator.isLoading} success={mutator.isSuccess}>
            {p.plugin ? 'Save Changes' : 'Create Plugin'}
          </Button>
        </Dialog.Actions>

        <mutator.RenderError />
      </FormStack>
    </form>
  );
};

export let showPluginForm = (
  p: Omit<Parameters<typeof PluginForm>[0], 'close'> & { title?: string; description?: string }
) =>
  showModal(({ dialogProps, close }) => (
    <Dialog.Wrapper {...dialogProps} width={520}>
      <Dialog.Title>{p.title ?? (p.plugin ? 'Edit Plugin' : 'New Plugin')}</Dialog.Title>
      <Dialog.Description>
        {p.description ??
          (p.plugin
            ? 'Update how this plugin is listed in the marketplace.'
            : 'Create a plugin to group related skills in this marketplace.')}
      </Dialog.Description>
      <PluginForm {...p} close={close} />
    </Dialog.Wrapper>
  ));
