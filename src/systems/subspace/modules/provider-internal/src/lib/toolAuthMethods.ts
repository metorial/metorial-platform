import type { ProviderAuthMethod, ProviderTool } from '@metorial-subspace/db';

export type ToolAuthMethodCarrier = Pick<ProviderTool, 'value'>;

export type ToolAuthMethodSource = Pick<ProviderAuthMethod, 'key'> | null | undefined;

export let checkToolAuthMethodSatisfied = (
  tool: ToolAuthMethodCarrier,
  authMethod: ToolAuthMethodSource
) => {
  let toolAuthMethods = tool.value?.authMethods;
  if (!Array.isArray(toolAuthMethods) || toolAuthMethods.length === 0) {
    return { allowed: true as const };
  }

  // Backwards compatibility: older callers may not pass an active auth method, so skip the check.
  if (!authMethod?.key) {
    return { allowed: true as const };
  }

  return { allowed: toolAuthMethods.includes(authMethod.key) };
};

export let filterToolsByAuthMethod = <T extends ToolAuthMethodCarrier>(
  tools: T[],
  authMethod: ToolAuthMethodSource
): T[] => tools.filter(tool => checkToolAuthMethodSatisfied(tool, authMethod).allowed);
