export let agentTrackingClientFamilies = {
  claude_code: { name: 'Claude Code', serviceFamily: 'claude-code' }
} as const;

export type AgentTrackingClientFamily = keyof typeof agentTrackingClientFamilies;

export let agentTrackingClientFamilyKeys = Object.keys(
  agentTrackingClientFamilies
) as AgentTrackingClientFamily[];

let isClientFamily = (family: string): family is AgentTrackingClientFamily =>
  Object.prototype.hasOwnProperty.call(agentTrackingClientFamilies, family);

export let toServiceFamily = (family: string) =>
  isClientFamily(family) ? agentTrackingClientFamilies[family].serviceFamily : family;

export let fromServiceFamily = (family: string) =>
  isClientFamily(family)
    ? family
    : (agentTrackingClientFamilyKeys.find(
        key => agentTrackingClientFamilies[key].serviceFamily == family
      ) ?? family);

export let clientFamilyName = (family: string) =>
  isClientFamily(family) ? agentTrackingClientFamilies[family].name : null;
