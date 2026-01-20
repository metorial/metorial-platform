export type ToolData = {
  id: string;
  name: string;
  description: string | null;
  inputSchema: unknown;
  outputSchema: unknown;
  providerId: string;
  providerSpecificationId: string;
  createdAt: Date;
  updatedAt: Date;
};

export let toolPresenter = (tool: ToolData) => ({
  object: 'provider.tool' as const,
  id: tool.id,
  name: tool.name,
  description: tool.description,
  inputSchema: tool.inputSchema,
  outputSchema: tool.outputSchema,
  providerId: tool.providerId,
  providerSpecificationId: tool.providerSpecificationId,
  createdAt: tool.createdAt,
  updatedAt: tool.updatedAt
});
