import { db, type SpecificationTool } from '@metorial-subspace/db';
import { type EvidenceTool, readHints } from '../evidence';

let isCallable = (tool: SpecificationTool) =>
  tool.mcpToolType.type == 'mcp.tool' || tool.mcpToolType.type == 'tool.callable';

let annotationsOf = (tool: SpecificationTool) =>
  tool.mcpToolType.type == 'mcp.tool' ? tool.mcpToolType.annotations : undefined;

export let toEvidenceTool = (tool: SpecificationTool): EvidenceTool => {
  let annotations = annotationsOf(tool);
  let hints = readHints(annotations);

  return {
    key: tool.key,
    name: tool.title ?? tool.name,
    description: tool.description ?? null,
    inputSchema: tool.inputJsonSchema,
    annotations,
    hints: {
      ...hints,
      readOnly: hints.readOnly ?? tool.tags?.readOnly,
      destructive: hints.destructive ?? tool.tags?.destructive
    }
  };
};

export let loadSpecification = async (specificationOid: bigint | null) => {
  if (!specificationOid) return null;

  let specification = await db.providerSpecification.findUnique({
    where: { oid: specificationOid }
  });
  if (!specification) return null;

  let value = specification.value;

  return {
    oid: specification.oid,
    hash: specification.hash,
    tools: value.tools.filter(isCallable).map(toEvidenceTool),
    files: {
      'spec.json': JSON.stringify(
        {
          name: value.specification.name,
          description: value.specification.description ?? null,
          serverInfo: value.specification.mcp?.serverInfo ?? null,
          instructions: value.specification.mcp?.instructions ?? null,
          tools: value.tools.filter(isCallable).map(tool => tool.key)
        },
        null,
        2
      ),
      'auth.json': JSON.stringify(
        value.authMethods.map(method => ({
          type: method.type,
          key: method.key,
          name: method.name,
          description: method.description ?? null,
          scopes: (method as { scopes?: unknown }).scopes ?? null
        })),
        null,
        2
      ),
      ...Object.fromEntries(
        value.tools.filter(isCallable).map(tool => [
          `tools/${tool.key.replace(/[^\w.-]+/g, '_')}.json`,
          JSON.stringify(
            {
              key: tool.key,
              name: tool.name,
              title: tool.title ?? null,
              description: tool.description ?? null,
              inputSchema: tool.inputJsonSchema,
              annotations: annotationsOf(tool) ?? null,
              scopes: tool.scopes ?? null
            },
            null,
            2
          )
        ])
      )
    } as Record<string, string>
  };
};

export type LoadedSpecification = NonNullable<Awaited<ReturnType<typeof loadSpecification>>>;
