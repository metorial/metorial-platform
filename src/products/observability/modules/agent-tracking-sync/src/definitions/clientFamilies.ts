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

// The tools Metorial Desktop configures (McpClientType keys) and the agent catalog id each one is.
// VS Code is an editor rather than an agent, so it has none.
export let mcpClientCatalogAgents: Record<string, string | null> = {
  'claude-code': 'claude-code',
  'claude-desktop': 'claude-desktop',
  codex: 'codex',
  cursor: 'cursor',
  vscode: null
};

export let catalogAgentForMcpClient = (key: string) =>
  Object.prototype.hasOwnProperty.call(mcpClientCatalogAgents, key)
    ? mcpClientCatalogAgents[key]!
    : null;

export let mcpClientForCatalogAgent = (agentId: string) =>
  Object.keys(mcpClientCatalogAgents).find(key => mcpClientCatalogAgents[key] == agentId) ??
  null;
