import { useSkillGroups } from '@metorial/state';
import { Button, Combobox, Dialog, showModal, Spacer } from '@metorial/ui';
import { useRef, useState } from 'react';

let SkillGroupPicker = (p: {
  instanceId: string;
  close: () => void;
  onSelect: (skillGroupId: string) => void;
}) => {
  let [value, setValue] = useState<string | null>(null);

  return (
    <>
      <Combobox
        label="Skill Group"
        placeholder="Search skill groups"
        value={value}
        provider={({ searchQuery }) => {
          let groups = useSkillGroups(p.instanceId, {
            limit: 25,
            search: searchQuery,
            status: ['active']
          });

          return {
            items: (groups.data?.items ?? []).map(group => ({
              id: group.id,
              label: group.name,
              description: group.description ?? undefined
            })),
            isLoading: groups.isLoading,
            empty: searchQuery ? 'No matching skill groups found.' : 'No skill groups yet.'
          };
        }}
        onChange={next => setValue(next ?? null)}
      />

      <Spacer size={15} />

      <Dialog.Actions>
        <Button type="button" variant="outline" onClick={p.close}>
          Cancel
        </Button>
        <Button
          type="button"
          disabled={!value}
          onClick={() => {
            if (!value) return;
            p.onSelect(value);
            p.close();
          }}
        >
          Add to Group
        </Button>
      </Dialog.Actions>
    </>
  );
};

let SkillGroupPickerDialog = (p: {
  instanceId: string;
  dialogProps: any;
  close: () => void;
  onSelect: (skillGroupId: string) => void;
  onCancel: () => void;
}) => {
  let selected = useRef(false);

  return (
    <Dialog.Wrapper
      {...p.dialogProps}
      width={500}
      onOpenChange={(open: boolean) => {
        if (!open && !selected.current) p.onCancel();
        p.dialogProps.onOpenChange?.(open);
      }}
    >
      <Dialog.Title>Add to Group</Dialog.Title>
      <Dialog.Description>Choose the group to add the selected skills to.</Dialog.Description>

      <SkillGroupPicker
        instanceId={p.instanceId}
        close={p.close}
        onSelect={id => {
          selected.current = true;
          p.onSelect(id);
        }}
      />
    </Dialog.Wrapper>
  );
};

export let showSkillGroupPickerModal = (p: {
  instanceId: string;
  onSelect: (skillGroupId: string) => void;
  onCancel: () => void;
}) =>
  showModal(({ dialogProps, close }) => (
    <SkillGroupPickerDialog {...p} dialogProps={dialogProps} close={close} />
  ));
