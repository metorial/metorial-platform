export let agentTrackingClientFamilies = {
  claude_code: { name: 'Claude Code', serviceFamily: 'claude-code' }
} as const;

export type AgentTrackingClientFamily = keyof typeof agentTrackingClientFamilies;

export let agentTrackingClientFamilyKeys = Object.keys(
  agentTrackingClientFamilies
) as AgentTrackingClientFamily[];

let isClientFamily = (family: string): family is AgentTrackingClientFamily =>
  Object.hasOwn(agentTrackingClientFamilies, family);

// Metorial names a family by its key, the service by its serviceFamily. Both take either
// spelling, and a family Metorial does not know keeps its own.
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
