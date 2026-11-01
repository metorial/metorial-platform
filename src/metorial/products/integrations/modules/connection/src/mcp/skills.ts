import { isServiceError } from '@lowerdeck/error';
import type {
  JSONRPCErrorResponse,
  JSONRPCResponse,
  ListResourcesResult
} from '@modelcontextprotocol/sdk/types.js';
import type { RequestScopedSkills } from '../lib/requestSkills';

type ID = string | number;

type SkillsResponse = JSONRPCResponse | JSONRPCErrorResponse;

type SkillParams = { cursor?: string; uri?: string };

let skillMethods = ['skills/list', 'skills/get', 'resources/directory/read'] as const;

export type SkillMethod = (typeof skillMethods)[number];

export let isSkillMethod = (method: string): method is SkillMethod =>
  (skillMethods as readonly string[]).includes(method);

let errorResponse = (id: ID, code: number, message: string): JSONRPCErrorResponse => ({
  jsonrpc: '2.0',
  id,
  error: { code, message }
});

let resultResponse = (id: ID, result: Record<string, unknown>): JSONRPCResponse => ({
  jsonrpc: '2.0',
  id,
  result
});

let readParams = (params: unknown): SkillParams => {
  let input = params && typeof params === 'object' ? (params as Record<string, unknown>) : {};

  return {
    cursor: typeof input.cursor === 'string' ? input.cursor : undefined,
    uri: typeof input.uri === 'string' ? input.uri : undefined
  };
};

let withServiceErrorsAsInvalidParams = async <T extends SkillsResponse | null>(
  id: ID,
  run: () => Promise<T>
): Promise<T | JSONRPCErrorResponse> => {
  try {
    return await run();
  } catch (error) {
    if (!isServiceError(error)) throw error;
    return errorResponse(id, -32602, error.data.message);
  }
};

let skillHandlers: Record<
  SkillMethod,
  (skills: RequestScopedSkills, id: ID, params: SkillParams) => Promise<SkillsResponse>
> = {
  'skills/list': async (skills, id, { cursor }) =>
    resultResponse(id, { resultType: 'complete', ...(await skills.listSkills({ cursor })) }),

  'skills/get': async (skills, id, { uri }) => {
    if (!uri) return errorResponse(id, -32602, 'The uri parameter is required');

    let skill = await skills.getSkill({ uri });
    if (!skill) return errorResponse(id, -32602, `Unknown skill: ${uri}`);

    return resultResponse(id, { resultType: 'complete', skill });
  },

  'resources/directory/read': async (skills, id, { uri }) => {
    if (!uri) return errorResponse(id, -32602, 'The uri parameter is required');

    let directory = await skills.readDirectory({ uri });
    if (!directory) return errorResponse(id, -32602, `Unknown directory: ${uri}`);

    return resultResponse(id, { resultType: 'complete', ...directory });
  }
};

export let handleSkillsRequest = async (d: {
  skills: RequestScopedSkills | null;
  id: ID;
  method: SkillMethod;
  params: unknown;
}) => {
  let skills = d.skills;
  if (!skills) return errorResponse(d.id, -32601, 'Method not found');

  return await withServiceErrorsAsInvalidParams(d.id, () =>
    skillHandlers[d.method](skills, d.id, readParams(d.params))
  );
};

// Returns null for URIs outside the consumer's catalog so upstream skill:// resources still resolve.
export let readSkillResource = async (d: {
  skills: RequestScopedSkills;
  id: ID;
  uri: string;
}) =>
  await withServiceErrorsAsInvalidParams(d.id, async () => {
    let content = await d.skills.readResource({ uri: d.uri });
    return content ? resultResponse(d.id, { contents: [content] }) : null;
  });

export let listSkillResources = async (d: {
  skills: RequestScopedSkills;
  id: ID;
  cursor?: string;
  encodeNextCursor: (skillsCursor?: string) => string | undefined;
}): Promise<SkillsResponse> => {
  let page = await d.skills.listSkillDocuments({ cursor: d.cursor }).catch(error => {
    if (isServiceError(error)) return null;
    throw error;
  });
  if (!page) return errorResponse(d.id, -32000, 'Invalid cursor');

  let resources = page.documents.map(document => ({
    uri: document.uri,
    name: document.name,
    ...(document.description ? { description: document.description } : {}),
    mimeType: 'text/markdown',
    size: document.size
  }));

  return resultResponse(d.id, {
    resources,
    nextCursor: d.encodeNextCursor(page.nextCursor)
  } satisfies ListResourcesResult);
};
