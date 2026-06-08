import { DashboardInstanceSkillsTemplatesCreateOutput } from '@metorial/dashboard-sdk';
import { Dialog, showModal } from '@metorial/ui';
import { SkillTemplateForm } from './templateForm';

export let showSkillTemplateFormModal = (p: {
  instanceId: string;
  onCreate?: (skillTemplate: DashboardInstanceSkillsTemplatesCreateOutput) => void;
}) =>
  showModal(({ dialogProps, close }) => (
    <Dialog.Wrapper {...dialogProps} width={550}>
      <Dialog.Title>Create Skill Template</Dialog.Title>
      <Dialog.Description>
        Create a reusable template with files, providers, and integrations that can be used to
        start new skills.
      </Dialog.Description>

      <SkillTemplateForm {...p} close={close} onCreate={p.onCreate} />
    </Dialog.Wrapper>
  ));
