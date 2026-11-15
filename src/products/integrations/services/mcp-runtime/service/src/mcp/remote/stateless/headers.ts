import { STATELESS_PROTOCOL_VERSION } from './constants';

let HEADER_TOKEN_REGEX = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
let SAFE_HEADER_VALUE_REGEX = /^[\x20-\x7E\t]*$/;
let BASE64_SENTINEL_REGEX = /^=\?base64\?.*\?=$/;
let MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER;

let ALLOWED_HEADER_PARAM_TYPES = new Set(['string', 'integer', 'boolean']);
let NON_SCHEMA_KEYWORDS = new Set(['default', 'examples', 'const', 'enum']);

let NAMED_METHODS: Record<string, 'name' | 'uri'> = {
  'tools/call': 'name',
  'prompts/get': 'name',
  'resources/read': 'uri'
};

export interface ToolHeaderAnnotation {
  header: string;
  path: string[];
}

export type ToolHeaderValidation =
  | { ok: true; annotations: ToolHeaderAnnotation[] }
  | { ok: false; reason: string };

export let encodeHeaderValue = (value: string) => {
  let isSafe =
    SAFE_HEADER_VALUE_REGEX.test(value) &&
    value.trim() === value &&
    !BASE64_SENTINEL_REGEX.test(value);

  if (isSafe) return value;

  return `=?base64?${Buffer.from(value, 'utf8').toString('base64')}?=`;
};

export let getStandardHeaders = (request: { method: string; params?: any }) => {
  let headers: Record<string, string> = {
    'MCP-Protocol-Version': STATELESS_PROTOCOL_VERSION,
    'Mcp-Method': request.method
  };

  let nameField = NAMED_METHODS[request.method];
  let name = nameField ? request.params?.[nameField] : undefined;
  if (typeof name == 'string') headers['Mcp-Name'] = encodeHeaderValue(name);

  return headers;
};

export let validateToolHeaderAnnotations = (inputSchema: unknown): ToolHeaderValidation => {
  let annotations: ToolHeaderAnnotation[] = [];
  let seen = new Set<string>();
  let failure: string | null = null;

  let visit = (node: unknown, path: string[] | null, isRoot: boolean) => {
    if (failure || !node || typeof node != 'object') return;

    if (Array.isArray(node)) {
      for (let item of node) visit(item, null, false);
      return;
    }

    let schema = node as Record<string, unknown>;

    if ('x-mcp-header' in schema) {
      let reason = getAnnotationFailure(schema, path, isRoot, seen);
      if (reason) {
        failure = reason;
        return;
      }

      let header = schema['x-mcp-header'] as string;
      seen.add(header.toLowerCase());
      annotations.push({ header, path: path! });
    }

    for (let [key, value] of Object.entries(schema)) {
      if (NON_SCHEMA_KEYWORDS.has(key) || key == 'x-mcp-header') continue;

      if (key == 'properties' && value && typeof value == 'object' && !Array.isArray(value)) {
        for (let [propertyName, propertySchema] of Object.entries(value)) {
          visit(propertySchema, path ? [...path, propertyName] : null, false);
        }
        continue;
      }

      visit(value, null, false);
    }
  };

  visit(inputSchema, [], true);

  if (failure) return { ok: false, reason: failure };
  return { ok: true, annotations };
};

let getAnnotationFailure = (
  schema: Record<string, unknown>,
  path: string[] | null,
  isRoot: boolean,
  seen: Set<string>
) => {
  let header = schema['x-mcp-header'];

  if (isRoot || !path) {
    return 'x-mcp-header is only allowed on properties reachable through `properties` keys';
  }
  if (typeof header != 'string' || !header.length) {
    return 'x-mcp-header must be a non-empty string';
  }
  if (!HEADER_TOKEN_REGEX.test(header)) {
    return `x-mcp-header "${header}" is not a valid HTTP header name`;
  }
  if (seen.has(header.toLowerCase())) {
    return `x-mcp-header "${header}" is used more than once`;
  }
  if (typeof schema.type != 'string' || !ALLOWED_HEADER_PARAM_TYPES.has(schema.type)) {
    return `x-mcp-header "${header}" must annotate a string, integer, or boolean parameter`;
  }

  return null;
};

export let getToolParamHeaders = (
  annotations: ToolHeaderAnnotation[],
  args: Record<string, unknown> | undefined
) => {
  let headers: Record<string, string> = {};

  for (let annotation of annotations) {
    let value: unknown = args;
    for (let key of annotation.path) {
      value = value && typeof value == 'object' ? (value as any)[key] : undefined;
    }

    let stringValue = toHeaderString(value);
    if (stringValue === null) continue;

    headers[`Mcp-Param-${annotation.header}`] = encodeHeaderValue(stringValue);
  }

  return headers;
};

let toHeaderString = (value: unknown) => {
  if (typeof value == 'string') return value;
  if (typeof value == 'boolean') return value ? 'true' : 'false';

  if (
    typeof value == 'number' &&
    Number.isInteger(value) &&
    Math.abs(value) <= MAX_SAFE_INTEGER
  ) {
    return String(value);
  }

  return null;
};
