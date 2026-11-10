import { SkillGroupSettingsForm } from '@metorial/scene-skills';
import { Dialog, showModal } from '@metorial/ui';

export let showSkillGroupSettingsModal = (p: { instanceId: string; skillGroupId: string }) =>
  showModal(({ dialogProps, close }) => (
    <Dialog.Wrapper {...dialogProps} width={550}>
      <Dialog.Title>Group Settings</Dialog.Title>

      <SkillGroupSettingsForm
        instanceId={p.instanceId}
        skillGroupId={p.skillGroupId}
        onSaved={close}
        onCancel={close}
      />
    </Dialog.Wrapper>
  ));
