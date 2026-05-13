import { DashboardInstanceSkillGroupsCreateOutput } from '@metorial/dashboard-sdk';
import { Dialog, showModal } from '@metorial/ui';
import { SkillGroupForm } from './groupForm';

export let showSkillGroupFormModal = (p: {
  instanceId: string;
  onCreate?: (skillGroup: DashboardInstanceSkillGroupsCreateOutput) => void;
}) =>
  showModal(({ dialogProps, close }) => (
    <Dialog.Wrapper {...dialogProps} width={550}>
      <Dialog.Title>Create Skill Group</Dialog.Title>
      <Dialog.Description>
        Group related skills together with a name and description so they can be managed as a
        set.
      </Dialog.Description>

      <SkillGroupForm {...p} close={close} onCreate={p.onCreate} />
    </Dialog.Wrapper>
  ));
