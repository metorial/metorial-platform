import { db, type SpecificationTool } from '@metorial-subspace/db';
import { type EvidenceTool, readHints } from '../evidence';

let isCallable = (tool: SpecificationTool) =>
  tool.mcpToolType.type == 'mcp.tool' || tool.mcpToolType.type == 'tool.callable';

let isAdapterTool = (tool: SpecificationTool) => !!tool.adapterIdentifier;

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

let scopeIdsOf = (tool: SpecificationTool) =>
  (tool.scopes?.AND ?? []).flatMap(clause => clause.OR);

let findUnusedScopes = (d: {
  tools: SpecificationTool[];
  authMethods: { key: string; name: string; scopes?: unknown }[];
}) => {
  let used = new Set(d.tools.flatMap(scopeIdsOf));

  return d.authMethods.flatMap(method => {
    let requested = Array.isArray(method.scopes)
      ? (method.scopes as { id: string }[]).map(scope => scope.id)
      : [];
    let unused = requested.filter(id => !used.has(id));

    return unused.length ? [{ method: method.name, requested: requested.length, unused }] : [];
  });
};

export let loadSpecification = async (specificationOid: bigint | null) => {
  if (!specificationOid) return null;

  let specification = await db.providerSpecification.findUnique({
    where: { oid: specificationOid }
  });
  if (!specification) return null;

  let value = specification.value;
  let callable = value.tools.filter(isCallable);
  let reviewed = callable.filter(tool => !isAdapterTool(tool));

  return {
    oid: specification.oid,
    hash: specification.hash,
    tools: reviewed.map(toEvidenceTool),
    adapterToolCount: callable.length - reviewed.length,
    unusedScopes: findUnusedScopes({ tools: callable, authMethods: value.authMethods }),
    files: {
      'spec.json': JSON.stringify(
        {
          name: value.specification.name,
          description: value.specification.description ?? null,
          serverInfo: value.specification.mcp?.serverInfo ?? null,
          instructions: value.specification.mcp?.instructions ?? null,
          tools: reviewed.map(tool => tool.key)
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
          ...(Array.isArray((method as { scopes?: unknown }).scopes)
            ? { scopes: (method as { scopes?: unknown }).scopes }
            : {})
        })),
        null,
        2
      ),
      ...Object.fromEntries(
        reviewed.map(tool => [
          `tools/${tool.key.replace(/[^\w.-]+/g, '_')}.json`,
          JSON.stringify(
            {
              key: tool.key,
              name: tool.name,
              title: tool.title ?? null,
              description: tool.description ?? null,
              inputSchema: tool.inputJsonSchema,
              annotations: annotationsOf(tool) ?? null,
              tags: tool.tags ?? null,
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
