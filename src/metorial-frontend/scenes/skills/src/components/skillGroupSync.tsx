import { renderWithLoader } from '@metorial/data-hooks';
import {
  type SkillPluginSkillGroupMatch,
  useAttachSkillPluginToSkillGroup,
  useSkillGroups,
  useSkillPluginSkillGroupMatches
} from '@metorial/state';
import { Button, Callout, Combobox, Dialog, showModal } from '@metorial/ui';
import { useState } from 'react';
import styled from 'styled-components';

let suggestionMinSharedSkills = 2;

let Stack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

let countOf = (count: number, one: string, many: string) =>
  count == 1 ? `1 ${one}` : `${count} ${many}`;

export let isSuggestedSkillGroupMatch = (
  match: SkillPluginSkillGroupMatch | undefined,
  pluginSkillCount: number
): match is SkillPluginSkillGroupMatch =>
  !!match &&
  match.sharedSkillCount >= suggestionMinSharedSkills &&
  match.sharedSkillCount * 2 >= pluginSkillCount;

export let SkillGroupCombobox = (p: {
  instanceId: string;
  value: { id: string; name: string } | null;
  onChange: (skillGroup: { id: string; name: string } | null) => void;
  label?: string;
  autoFocus?: boolean;
}) => (
  <Combobox
    label={p.label ?? 'Skill Group'}
    placeholder="Search skill groups…"
    autoFocus={p.autoFocus}
    value={p.value?.id ?? null}
    valueLabel={p.value?.name}
    provider={({ searchQuery }) => {
      let skillGroups = useSkillGroups(p.instanceId, {
        status: ['active'],
        search: searchQuery,
        limit: 25
      });

      return {
        items: (skillGroups.data?.items ?? []).map(skillGroup => ({
          id: skillGroup.id,
          label: skillGroup.name,
          description: skillGroup.description ?? undefined
        })),
        isLoading: skillGroups.isLoading,
        empty: searchQuery ? 'No matching skill groups.' : 'No skill groups yet.'
      };
    }}
    onChange={(id, item) => p.onChange(id && item ? { id, name: item.label } : null)}
  />
);

let describeSkillChanges = (match: SkillPluginSkillGroupMatch) => {
  let added = match.skillIdsToAdd.length;
  let removed = match.skillIdsToRemove.length;

  if (!added && !removed) return 'The plugin already has exactly these skills.';
  if (!removed) return `Adds ${countOf(added, 'skill', 'skills')}.`;
  if (!added) return `Removes ${countOf(removed, 'skill', 'skills')}.`;

  return `Adds ${countOf(added, 'skill', 'skills')} and removes ${removed}.`;
};

let SkillChanges = (p: {
  instanceId: string;
  skillPluginId: string;
  skillGroupId: string;
}) => {
  let matches = useSkillPluginSkillGroupMatches(p.instanceId, p.skillPluginId, p.skillGroupId);

  return renderWithLoader({ matches })(({ matches }) => {
    let match = matches.data.items[0];
    if (!match) return null;

    return (
      <Callout color={match.skillIdsToRemove.length ? 'orange' : 'gray'} size="1">
        {describeSkillChanges(match)}
      </Callout>
    );
  });
};

let SyncWithSkillGroupDialog = (p: {
  instanceId: string;
  skillPlugin: { id: string; name: string };
  initialSkillGroup?: { id: string; name: string };
  close: () => void;
  onSynced: () => Promise<void> | void;
}) => {
  let attach = useAttachSkillPluginToSkillGroup();
  let [skillGroup, setSkillGroup] = useState(p.initialSkillGroup ?? null);

  let submit = async () => {
    if (!skillGroup) return;

    let [attached] = await attach.mutate({
      instanceId: p.instanceId,
      skillPluginId: p.skillPlugin.id,
      skillGroupId: skillGroup.id
    });
    if (!attached) return;

    await p.onSynced();
    p.close();
  };

  return (
    <Stack>
      <SkillGroupCombobox
        instanceId={p.instanceId}
        value={skillGroup}
        onChange={setSkillGroup}
        autoFocus={!p.initialSkillGroup}
      />

      {skillGroup && (
        <SkillChanges
          instanceId={p.instanceId}
          skillPluginId={p.skillPlugin.id}
          skillGroupId={skillGroup.id}
        />
      )}

      <Dialog.Actions>
        <Button type="button" variant="soft" disabled={attach.isLoading} onClick={p.close}>
          Cancel
        </Button>
        <Button
          disabled={!skillGroup}
          loading={attach.isLoading}
          success={attach.isSuccess}
          onClick={submit}
        >
          Sync With Skill Group
        </Button>
      </Dialog.Actions>

      <attach.RenderError />
    </Stack>
  );
};

export let showSyncWithSkillGroupDialog = (
  p: Omit<Parameters<typeof SyncWithSkillGroupDialog>[0], 'close'>
) =>
  showModal(({ dialogProps, close }) => (
    <Dialog.Wrapper {...dialogProps} width={520}>
      <Dialog.Title>Sync With Skill Group</Dialog.Title>
      <Dialog.Description>
        {p.skillPlugin.name} takes the group's skills and follows its changes. To edit its
        skills directly again, detach it.
      </Dialog.Description>
      <SyncWithSkillGroupDialog {...p} close={close} />
    </Dialog.Wrapper>
  ));

export let SkillGroupSuggestion = (p: {
  match: SkillPluginSkillGroupMatch;
  pluginSkillCount: number;
  onSync: () => void;
}) => (
  <Callout
    color="blue"
    size="1"
    action={
      <Button size="1" variant="outline" onClick={p.onSync}>
        Sync With Skill Group
      </Button>
    }
  >
    {p.match.sharedSkillCount == p.pluginSkillCount
      ? `All of these skills are in the ${p.match.skillGroup.name} skill group.`
      : `${p.match.sharedSkillCount} of these ${p.pluginSkillCount} skills are in the ${p.match.skillGroup.name} skill group.`}{' '}
    Sync to follow its changes.
  </Callout>
);
