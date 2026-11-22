import { useDashboardFlags } from '../organization/loaders/flags';
import { useCurrentOrganization } from '../organization/current';

export let useAiAvailable = () => {
  let flags = useDashboardFlags();

  return flags.data?.flags['ai-available'] === true;
};

export let useMetorialAssistantEnabled = () => {
  let organization = useCurrentOrganization();
  let aiAvailable = useAiAvailable();

  return aiAvailable && organization.data?.currentProject?.assistantEnabled === true;
};
