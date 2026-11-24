import type {
  JSONSchema7,
  LanguageModelV4CallOptions,
  LanguageModelV4FunctionTool,
  SharedV4ProviderOptions
} from '@ai-sdk/provider';
import { invalidParam } from './errors';
import { at, isObject, optional, readBoolean, readObject, readString } from './read';

export type ReasoningEffort = NonNullable<LanguageModelV4CallOptions['reasoning']>;

export let reasoningEfforts = [
  'none',
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
  'max'
] as const;

let emptySchema: JSONSchema7 = { type: 'object', properties: {} };

let toolNamePattern = /^[a-zA-Z0-9_-]{1,128}$/;

export let readToolName = (value: unknown, path: string) => {
  let name = readString(value, path);
  if (!toolNamePattern.test(name)) {
    throw invalidParam(
      path,
      `"${path}" must be 1-128 characters of letters, digits, underscores or hyphens.`
    );
  }

  return name;
};

export let readJsonSchema = (value: unknown, path: string): JSONSchema7 => {
  if (value === undefined || value === null) return emptySchema;
  return readObject(value, path) as JSONSchema7;
};

export let functionTool = (d: {
  name: string;
  description?: string;
  schema: JSONSchema7;
  strict?: boolean;
  providerOptions?: SharedV4ProviderOptions;
}): LanguageModelV4FunctionTool => ({
  type: 'function',
  name: d.name,
  description: d.description,
  inputSchema: d.schema,
  strict: d.strict,
  providerOptions: d.providerOptions
});

export let assertUniqueToolNames = (tools: LanguageModelV4FunctionTool[], path: string) => {
  let seen = new Set<string>();
  tools.forEach((tool, position) => {
    if (seen.has(tool.name)) {
      throw invalidParam(
        `${path}[${position}]`,
        `The tool name "${tool.name}" is used twice.`
      );
    }
    seen.add(tool.name);
  });
};

export let assertKnownTool = (
  tools: LanguageModelV4FunctionTool[] | undefined,
  name: string,
  path: string
) => {
  if (!tools?.some(tool => tool.name == name)) {
    throw invalidParam(path, `The tool "${name}" is not in the request's tools.`);
  }
};

export let readJsonSchemaFormat = (value: unknown, path: string) => {
  let format = readObject(value, path);

  return {
    type: 'json' as const,
    schema: readJsonSchema(format.schema, at(path, 'schema')),
    name: optional(format.name, value => readString(value, at(path, 'name'))),
    description: optional(format.description, value =>
      readString(value, at(path, 'description'))
    ),
    strict: optional(format.strict, value => readBoolean(value, at(path, 'strict')))
  };
};

export let mergeProviderOptions = (
  ...entries: (SharedV4ProviderOptions | undefined)[]
): SharedV4ProviderOptions | undefined => {
  let merged: SharedV4ProviderOptions = {};

  for (let entry of entries) {
    if (!entry) continue;
    for (let [namespace, value] of Object.entries(entry)) {
      let defined = Object.fromEntries(
        Object.entries(value).filter(([, field]) => field !== undefined)
      );
      if (Object.keys(defined).length)
        merged[namespace] = { ...merged[namespace], ...defined };
    }
  }

  return Object.keys(merged).length ? merged : undefined;
};

export let stringOrTextParts = (value: unknown, path: string, partType = 'text') => {
  if (typeof value == 'string') return value;
  if (!Array.isArray(value)) {
    throw invalidParam(path, `"${path}" must be a string or an array of text parts.`);
  }

  return value
    .map((part, position) => {
      let partPath = `${path}[${position}]`;
      if (!isObject(part) || part.type != partType) {
        throw invalidParam(partPath, `"${partPath}" must be a ${partType} part.`);
      }

      return readString(part.text, at(partPath, 'text'));
    })
    .join('\n\n');
};
