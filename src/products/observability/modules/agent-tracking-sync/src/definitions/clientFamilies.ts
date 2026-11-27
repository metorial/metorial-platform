import { agentSeeds } from '@metorial/model-catalog/src/registry/agents';

export let agentTrackingClientFamilies = {
  claude_code: { name: 'Claude Code', serviceFamily: 'claude-code' }
} as const;

let otherClientFamilyNames = new Map([
  ['codex', 'Codex'],
  ['cursor', 'Cursor'],
  ['opencode', 'OpenCode'],
  ['antigravity', 'Antigravity'],
  ['copilot', 'GitHub Copilot']
]);

let registryNames = new Map(agentSeeds.map(agent => [agent.id, agent.name]));

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

export let clientFamilyName = (family: string): string | null =>
  isClientFamily(family)
    ? agentTrackingClientFamilies[family].name
    : (otherClientFamilyNames.get(family) ?? registryNames.get(family) ?? null);
