import { DashboardInstanceSkillsPluginsCreateOutput } from '@metorial/dashboard-sdk';
import { Dialog, showModal } from '@metorial/ui';
import { SkillPluginForm } from './pluginForm';

export let showSkillPluginFormModal = (p: {
  instanceId: string;
  onCreate?: (plugin: DashboardInstanceSkillsPluginsCreateOutput) => void;
}) =>
  showModal(({ dialogProps, close }) => (
    <Dialog.Wrapper {...dialogProps} width={550}>
      <Dialog.Title>Create Skill Plugin</Dialog.Title>
      <Dialog.Description>
        Create a reusable plugin that can include one or more skills and be added to
        marketplaces.
      </Dialog.Description>

      <SkillPluginForm {...p} close={close} onCreate={p.onCreate} />
    </Dialog.Wrapper>
  ));
