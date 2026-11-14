import { useCurrentOrganization } from '../organization/current';

export let useMetorialAssistantEnabled = () => {
  let organization = useCurrentOrganization();

  return organization.data?.currentProject?.assistantEnabled === true;
};
