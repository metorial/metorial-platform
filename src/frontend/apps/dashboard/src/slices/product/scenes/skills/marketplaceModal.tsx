import { DashboardInstanceSkillsMarketplacesCreateOutput } from '@metorial/dashboard-sdk';
import { Dialog, showModal } from '@metorial/ui';
import { SkillMarketplaceForm } from './marketplaceForm';

export let showSkillMarketplaceFormModal = (p: {
  instanceId: string;
  onCreate?: (marketplace: DashboardInstanceSkillsMarketplacesCreateOutput) => void;
}) =>
  showModal(({ dialogProps, close }) => (
    <Dialog.Wrapper {...dialogProps} width={550}>
      <Dialog.Title>Create Skill Marketplace</Dialog.Title>
      <Dialog.Description>
        Create a marketplace to publish selected skill plugins and individual skills.
      </Dialog.Description>

      <SkillMarketplaceForm {...p} close={close} onCreate={p.onCreate} />
    </Dialog.Wrapper>
  ));
