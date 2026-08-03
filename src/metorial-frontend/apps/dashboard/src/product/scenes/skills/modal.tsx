import { DashboardInstanceSkillsCreateOutput } from '@metorial/dashboard-sdk';
import { Dialog, showModal } from '@metorial/ui';
import { SkillForm } from './form';

export let showSkillFormModal = (p: {
  instanceId: string;
  onCreate?: (skill: DashboardInstanceSkillsCreateOutput) => void;
}) =>
  showModal(({ dialogProps, close }) => (
    <Dialog.Wrapper {...dialogProps} width={550}>
      <Dialog.Title>Create Skill</Dialog.Title>
      <Dialog.Description>
        Create a reusable skill with a clear name and description so it can be expanded
        with providers and integrations later.
      </Dialog.Description>

      <SkillForm {...p} close={close} onCreate={p.onCreate} />
    </Dialog.Wrapper>
  ));
